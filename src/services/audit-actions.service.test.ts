import { inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "../infrastructure/database/client";
import { auditLogs } from "../infrastructure/database/schema";
import { auditActionFiltersDto } from "../interfaces/http/dtos/audit-actions.dto";
import { AuditActionsService } from "./audit-actions.service";

/** Passa pelo parser zod real, igual à rota — exercita os defaults de `page`/`limit`. */
function list(input: Partial<Record<string, unknown>> = {}) {
  return AuditActionsService.list(auditActionFiltersDto.parse(input));
}

/**
 * A trilha de ações administrativas é o que sustenta a decisão de deixar qualquer portador de
 * `staff.manage` editar a equipe: sem consulta confiável, o registro não serve para rastrear nada.
 */
describe("AuditActionsService.list (banco real)", () => {
  const createdIds: number[] = [];
  const stamp = Date.now();
  const entityId = `audit-actions-${stamp}`;

  beforeAll(async () => {
    const rows = [
      {
        actorType: "staff_user" as const,
        actorId: 1,
        action: "staff.updated",
        entityType: "staff_users",
        entityId,
        before: { name: "Antes" },
        after: { name: "Depois", passwordChanged: true, actorEmail: `ator-${stamp}@test.local` },
        createdAt: new Date("2026-03-10T10:00:00Z"),
      },
      {
        actorType: "staff_user" as const,
        actorId: 1,
        action: "bot_user.blocked",
        entityType: "bot_users",
        entityId,
        after: { isActive: false, actorEmail: `ator-${stamp}@test.local` },
        createdAt: new Date("2026-03-11T10:00:00Z"),
      },
      {
        // Ator removido: `actorId` aponta para uma conta que não existe mais.
        actorType: "staff_user" as const,
        actorId: 999999999,
        action: "wallet.admin_credit",
        entityType: "bot_users",
        entityId,
        after: { amount: 50, actorEmail: `removido-${stamp}@test.local` },
        createdAt: new Date("2026-03-12T10:00:00Z"),
      },
    ];

    for (const row of rows) {
      const [created] = await db.insert(auditLogs).values(row).$returningId();
      createdIds.push(created.id);
    }
  });

  afterAll(async () => {
    if (createdIds.length) await db.delete(auditLogs).where(inArray(auditLogs.id, createdIds));
  });

  it("lista as ações mais recentes primeiro", async () => {
    const result = await list({ search: entityId, limit: 100 });

    expect(result.data.length).toBeGreaterThanOrEqual(3);
    const timestamps = result.data.map((row) => new Date(row.createdAt).getTime());
    expect(timestamps).toEqual([...timestamps].sort((a, b) => b - a));
  });

  it("filtra por ação", async () => {
    const result = await list({ search: entityId, action: "staff.updated", limit: 100 });

    expect(result.data.every((row) => row.action === "staff.updated")).toBe(true);
    expect(result.data.length).toBeGreaterThanOrEqual(1);
  });

  it("filtra por tipo de entidade", async () => {
    const result = await list({ search: entityId, entityType: "bot_users", limit: 100 });

    expect(result.data.every((row) => row.entityType === "bot_users")).toBe(true);
    expect(result.data.length).toBeGreaterThanOrEqual(2);
  });

  it("devolve o antes e o depois de cada alteração", async () => {
    const result = await list({ search: entityId, action: "staff.updated", limit: 100 });
    const entry = result.data.find((row) => row.entityId === entityId);

    expect(entry?.before).toMatchObject({ name: "Antes" });
    expect(entry?.after).toMatchObject({ name: "Depois", passwordChanged: true });
  });

  // Sem esse fallback, apagar a conta de um administrador apagaria também o rastro de quem ele foi
  // — exatamente o cenário em que a trilha mais importa.
  it("preserva o e-mail do ator mesmo quando a conta dele não existe mais", async () => {
    const result = await list({ search: entityId, action: "wallet.admin_credit", limit: 100 });
    const entry = result.data.find((row) => row.entityId === entityId);

    expect(entry?.actorName).toBeNull();
    expect(entry?.actorEmail).toBe(`removido-${stamp}@test.local`);
  });

  it("busca pelo e-mail do ator guardado no JSON", async () => {
    const result = await list({ search: `removido-${stamp}@test.local`, limit: 100 });
    expect(result.data.length).toBeGreaterThanOrEqual(1);
  });

  it("filtra por período customizado", async () => {
    const result = await list({ search: entityId, period: "custom", start: "2026-03-11", end: "2026-03-11", limit: 100 });

    expect(result.data).toHaveLength(1);
    expect(result.data[0]!.action).toBe("bot_user.blocked");
  });

  it("pagina corretamente, mantendo o total", async () => {
    const result = await list({ search: entityId, page: 1, limit: 2 });

    expect(result.data).toHaveLength(2);
    expect(result.pagination.total).toBeGreaterThanOrEqual(3);
  });
});
