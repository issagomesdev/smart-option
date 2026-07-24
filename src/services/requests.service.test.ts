import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../payments/payment.service", () => ({
  paymentService: { createWithdrawalTransfer: vi.fn() },
}));

import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll } from "vitest";
import { db } from "../infrastructure/database/client";
import { auditLogs, botUsers, checkouts, supportRequests, withdrawals } from "../infrastructure/database/schema";
import { paymentService } from "../payments/payment.service";
import { RequestService } from "./requests.service";

/**
 * Regressão para o bug corrigido na Fase 6: a rota `POST /res-withdrawal`
 * chamava `resWithdrawal(req.body.res)` — passava só o booleano, então
 * `body.id`/`body.observation` chegavam como `undefined` dentro do service e
 * a aprovação/rejeição de saque pelo painel nunca gravava o registro certo.
 * Este teste garante que `resWithdrawal` recebe e usa o corpo inteiro.
 */
describe("RequestService.resWithdrawal (integração, banco real)", () => {
  let userId: number;
  const withdrawalIds: number[] = [];

  beforeAll(async () => {
    const stamp = Date.now();
    const [user] = await db
      .insert(botUsers)
      .values({
        name: "Withdrawal Approval Test",
        email: `res-withdrawal-${stamp}@test.local`,
        password: "x",
        phoneNumber: "11900000000",
        adress: "Rua Teste, 1",
        pixCode: "chave-pix-teste",
      })
      .$returningId();
    userId = user.id;
  });

  afterAll(async () => {
    if (withdrawalIds.length) {
      await db.delete(auditLogs).where(inArray(auditLogs.entityId, withdrawalIds.map(String)));
    }
    await db.delete(withdrawals).where(eq(withdrawals.userId, userId));
    await db.delete(botUsers).where(eq(botUsers.id, userId));
  });

  beforeEach(() => {
    vi.mocked(paymentService.createWithdrawalTransfer).mockReset();
  });

  async function createWithdrawal(): Promise<number> {
    const [inserted] = await db
      .insert(withdrawals)
      .values({ userId, value: "150.00", referenceId: crypto.randomUUID() })
      .$returningId();
    withdrawalIds.push(inserted.id);
    return inserted.id;
  }

  it("res=false marca a solicitação como recusada, gravando a observação, sem chamar o gateway de pagamento", async () => {
    const withdrawalId = await createWithdrawal();

    const result = await RequestService.resWithdrawal({ res: false, id: withdrawalId, observation: "Dados bancários inválidos" });

    expect(result).toEqual({ status: true, message: "Solicitação respondida com sucesso!" });
    expect(paymentService.createWithdrawalTransfer).not.toHaveBeenCalled();

    const [row] = await db.select().from(withdrawals).where(eq(withdrawals.id, withdrawalId));
    expect(row.status).toBe("refused");
    expect(row.replyObservation).toBe("Dados bancários inválidos");
  });

  it("res=true aprova a solicitação, chama o gateway com o id correto e grava o transactionId retornado", async () => {
    const withdrawalId = await createWithdrawal();
    vi.mocked(paymentService.createWithdrawalTransfer).mockResolvedValue({ externalId: "transfer-ext-123" } as never);

    const result = await RequestService.resWithdrawal({ res: true, id: withdrawalId, observation: "Aprovado manualmente" });

    expect(result).toEqual({ status: true, message: "Solicitação respondida com sucesso!" });
    expect(paymentService.createWithdrawalTransfer).toHaveBeenCalledWith(
      { id: userId },
      expect.objectContaining({ userId, amount: 150, pixKey: "chave-pix-teste", legacyReferenceId: String(withdrawalId) }),
    );

    const [row] = await db.select().from(withdrawals).where(eq(withdrawals.id, withdrawalId));
    expect(row.status).toBe("authorized");
    expect(row.replyObservation).toBe("Aprovado manualmente");
    expect(row.transactionId).toBe("transfer-ext-123");
  });

  /**
   * Gap de segurança encontrado na pesquisa da Fase 5 (RBAC): a ação mais
   * sensível do sistema (aprovar/rejeitar saque, dispara PIX real) nunca
   * gravava em `audit_logs`, ao contrário do ajuste manual de saldo
   * (`transfValuesAdmin`), que já gravava desde a Fase 4. Corrigido junto com
   * a aplicação de `requirePermission('withdrawals.approve')` na rota.
   */
  it("grava em audit_logs tanto a aprovação quanto a rejeição, com o autor identificado", async () => {
    const actor = { id: 4242, email: "auditor-teste@test.local" };

    const approvedId = await createWithdrawal();
    vi.mocked(paymentService.createWithdrawalTransfer).mockResolvedValue({ externalId: "transfer-audit-1" } as never);
    await RequestService.resWithdrawal({ res: true, id: approvedId, observation: "aprovado" }, actor);

    const refusedId = await createWithdrawal();
    await RequestService.resWithdrawal({ res: false, id: refusedId, observation: "recusado" }, actor);

    const [approvedLog] = await db.select().from(auditLogs).where(eq(auditLogs.entityId, String(approvedId)));
    expect(approvedLog).toMatchObject({
      actorType: "staff_user",
      actorId: actor.id,
      action: "withdrawal.approved",
      entityType: "withdrawals",
      after: { transactionId: "transfer-audit-1", observation: "aprovado", actorEmail: actor.email },
    });

    const [refusedLog] = await db.select().from(auditLogs).where(eq(auditLogs.entityId, String(refusedId)));
    expect(refusedLog).toMatchObject({
      actorType: "staff_user",
      actorId: actor.id,
      action: "withdrawal.refused",
      entityType: "withdrawals",
      after: { observation: "recusado", actorEmail: actor.email },
    });
  });

  it("res=true com solicitação inexistente lança NotFoundError", async () => {
    await expect(RequestService.resWithdrawal({ res: true, id: 999999999 })).rejects.toThrow("Solicitação de saque não encontrada");
  });

  it("res=true com falha no gateway retorna status false em vez de lançar, e não altera o status da solicitação", async () => {
    const withdrawalId = await createWithdrawal();
    vi.mocked(paymentService.createWithdrawalTransfer).mockRejectedValue(new Error("Falha de rede"));

    const result = await RequestService.resWithdrawal({ res: true, id: withdrawalId });

    expect(result.status).toBe(false);

    const [row] = await db.select().from(withdrawals).where(eq(withdrawals.id, withdrawalId));
    expect(row.status).toBe("pending");
  });
});

/**
 * Fase 0 (pré-requisito do painel admin): as rotas de listagem passaram a
 * suportar `page`/`limit` server-side. Este teste garante que o total bate
 * com o conjunto inteiro (não só a página) e que as páginas não se
 * sobrepõem/pulam registros.
 */
describe("RequestService.withdrawalRequests (paginação, banco real)", () => {
  let userId: number;
  const withdrawalIds: number[] = [];

  beforeAll(async () => {
    const stamp = Date.now();
    const [user] = await db
      .insert(botUsers)
      .values({
        name: "Pagination Test User",
        email: `pagination-withdrawal-${stamp}@test.local`,
        password: "x",
        phoneNumber: "11900000000",
        adress: "Rua Teste, 1",
        pixCode: "chave-pix-teste",
      })
      .$returningId();
    userId = user.id;

    for (let i = 0; i < 5; i++) {
      const [inserted] = await db
        .insert(withdrawals)
        .values({ userId, value: "10.00", referenceId: crypto.randomUUID() })
        .$returningId();
      withdrawalIds.push(inserted.id);
    }
  });

  afterAll(async () => {
    await db.delete(withdrawals).where(eq(withdrawals.userId, userId));
    await db.delete(botUsers).where(eq(botUsers.id, userId));
  });

  it("devolve o total real (5) mesmo pedindo uma página menor que o total", async () => {
    const result = await RequestService.withdrawalRequests(userId, { page: 1, limit: 2 });

    expect(result.data).toHaveLength(2);
    expect(result.pagination).toEqual({ page: 1, limit: 2, total: 5, totalPages: 3 });
  });

  it("páginas consecutivas não se sobrepõem e cobrem todos os registros", async () => {
    const page1 = await RequestService.withdrawalRequests(userId, { page: 1, limit: 2 });
    const page2 = await RequestService.withdrawalRequests(userId, { page: 2, limit: 2 });
    const page3 = await RequestService.withdrawalRequests(userId, { page: 3, limit: 2 });

    const allIds = [...page1.data, ...page2.data, ...page3.data].map((row) => row.id);
    expect(new Set(allIds).size).toBe(5);
    expect(allIds.sort((a, b) => a - b)).toEqual([...withdrawalIds].sort((a, b) => a - b));
    expect(page3.data).toHaveLength(1);
  });

  it("página além do total devolve lista vazia mas mantém o total correto", async () => {
    const result = await RequestService.withdrawalRequests(userId, { page: 99, limit: 2 });

    expect(result.data).toEqual([]);
    expect(result.pagination.total).toBe(5);
  });

  it("ordena por id asc/desc via sortBy/sortDirection", async () => {
    const asc = await RequestService.withdrawalRequests(userId, { page: 1, limit: 10, sortBy: "id", sortDirection: "asc" });
    const desc = await RequestService.withdrawalRequests(userId, { page: 1, limit: 10, sortBy: "id", sortDirection: "desc" });

    expect(asc.data.map((row) => row.id)).toEqual([...withdrawalIds].sort((a, b) => a - b));
    expect(desc.data.map((row) => row.id)).toEqual([...withdrawalIds].sort((a, b) => b - a));
  });

  it("cai no fallback (created_at) quando sortBy é desconhecido, sem lançar erro", async () => {
    const result = await RequestService.withdrawalRequests(userId, { page: 1, limit: 10, sortBy: "not-a-real-column" });
    expect(result.data).toHaveLength(5);
  });
});

/** Mesmo padrão de `withdrawalRequests` acima — só o essencial (paginação + ordenação), sem repetir toda a cobertura de filtros. */
describe("RequestService.depositsRequests (paginação/ordenação, banco real)", () => {
  let userId: number;
  const checkoutIds: number[] = [];

  beforeAll(async () => {
    const stamp = Date.now();
    const [user] = await db
      .insert(botUsers)
      .values({
        name: "Deposits Sort Test",
        email: `deposits-sort-${stamp}@test.local`,
        password: "x",
        phoneNumber: "11900000000",
        adress: "Rua Teste, 1",
        pixCode: "chave-pix-teste",
      })
      .$returningId();
    userId = user.id;

    for (let i = 0; i < 3; i++) {
      const [inserted] = await db
        .insert(checkouts)
        .values({ userId, type: "deposit", value: "10.00", referenceId: crypto.randomUUID() })
        .$returningId();
      checkoutIds.push(inserted.id);
    }
  });

  afterAll(async () => {
    await db.delete(checkouts).where(eq(checkouts.userId, userId));
    await db.delete(botUsers).where(eq(botUsers.id, userId));
  });

  it("ordena por id asc/desc via sortBy/sortDirection", async () => {
    const asc = await RequestService.depositsRequests(userId, { page: 1, limit: 10, sortBy: "id", sortDirection: "asc" });
    const desc = await RequestService.depositsRequests(userId, { page: 1, limit: 10, sortBy: "id", sortDirection: "desc" });

    expect(asc.data.map((row) => row.id)).toEqual([...checkoutIds].sort((a, b) => a - b));
    expect(desc.data.map((row) => row.id)).toEqual([...checkoutIds].sort((a, b) => b - a));
  });
});

describe("RequestService.subscriptionsRequests (paginação/ordenação, banco real)", () => {
  let userId: number;
  const checkoutIds: number[] = [];

  beforeAll(async () => {
    const stamp = Date.now();
    const [user] = await db
      .insert(botUsers)
      .values({
        name: "Subscriptions Sort Test",
        email: `subscriptions-sort-${stamp}@test.local`,
        password: "x",
        phoneNumber: "11900000000",
        adress: "Rua Teste, 1",
        pixCode: "chave-pix-teste",
      })
      .$returningId();
    userId = user.id;

    for (let i = 0; i < 3; i++) {
      const [inserted] = await db
        .insert(checkouts)
        .values({ userId, type: "subscription", value: "10.00", referenceId: crypto.randomUUID() })
        .$returningId();
      checkoutIds.push(inserted.id);
    }
  });

  afterAll(async () => {
    await db.delete(checkouts).where(eq(checkouts.userId, userId));
    await db.delete(botUsers).where(eq(botUsers.id, userId));
  });

  it("ordena por id asc/desc via sortBy/sortDirection", async () => {
    const asc = await RequestService.subscriptionsRequests(userId, { page: 1, limit: 10, sortBy: "id", sortDirection: "asc" });
    const desc = await RequestService.subscriptionsRequests(userId, { page: 1, limit: 10, sortBy: "id", sortDirection: "desc" });

    expect(asc.data.map((row) => row.id)).toEqual([...checkoutIds].sort((a, b) => a - b));
    expect(desc.data.map((row) => row.id)).toEqual([...checkoutIds].sort((a, b) => b - a));
  });
});

describe("RequestService.supportRequests (paginação/ordenação, banco real)", () => {
  let userId: number;
  const requestIds: number[] = [];

  beforeAll(async () => {
    const stamp = Date.now();
    const [user] = await db
      .insert(botUsers)
      .values({
        name: "Support Sort Test",
        email: `support-sort-${stamp}@test.local`,
        password: "x",
        phoneNumber: "11900000000",
        adress: "Rua Teste, 1",
        pixCode: "chave-pix-teste",
      })
      .$returningId();
    userId = user.id;

    for (let i = 0; i < 3; i++) {
      const [inserted] = await db
        .insert(supportRequests)
        .values({ userId, type: "support", subject: `Assunto ${i}`, telegramUserId: 123456 })
        .$returningId();
      requestIds.push(inserted.id);
    }
  });

  afterAll(async () => {
    await db.delete(supportRequests).where(eq(supportRequests.userId, userId));
    await db.delete(botUsers).where(eq(botUsers.id, userId));
  });

  it("ordena por id asc/desc via sortBy/sortDirection", async () => {
    const asc = await RequestService.supportRequests(userId, { page: 1, limit: 10, sortBy: "id", sortDirection: "asc" });
    const desc = await RequestService.supportRequests(userId, { page: 1, limit: 10, sortBy: "id", sortDirection: "desc" });

    expect(asc.data.map((row) => row.id)).toEqual([...requestIds].sort((a, b) => a - b));
    expect(desc.data.map((row) => row.id)).toEqual([...requestIds].sort((a, b) => b - a));
  });
});
