import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "../infrastructure/database/client";
import {
  auditLogs,
  botUsers,
  checkouts,
  staffUsers,
  walletTransactions,
  wallets,
  withdrawals,
} from "../infrastructure/database/schema";
import { auditFiltersDto, type AuditFilters } from "../interfaces/http/dtos/audit.dto";
import { AuditService } from "./audit.service";

/**
 * Passa pelo parser `zod` de verdade (mesmo `auditFiltersDto` que `validate()` aplica na rota HTTP)
 * em vez de construir o objeto já com todos os defaults (`page`, `limit`, `sortDirection`) — exercita
 * o caminho real, incluindo os defaults, e permite que os testes só informem o que é relevante para
 * cada caso.
 */
function list(input: Partial<AuditFilters>, scopedUserIds: number[] | null = null) {
  return AuditService.list(auditFiltersDto.parse(input), scopedUserIds);
}

/**
 * Fase 3: `AuditService.list` une 3 fontes (`wallet_transactions` sempre concluído, `withdrawals`
 * e `checkouts` só nos status ainda em aberto) numa única listagem paginada/filtrável/ordenável.
 * Este teste semeia exatamente uma linha "deve aparecer" por branch e uma linha "não deve aparecer"
 * por branch (as que já viraram ledger), além de duas linhas de `audit_logs` pros dois caminhos de
 * enriquecimento de "administrador responsável" (exato para saque aprovado, best-effort para ajuste
 * manual de saldo).
 */
describe("AuditService.list (banco real)", () => {
  let userId: number;
  let walletId: number;
  let staffId: number;
  const stamp = Date.now();
  const walletTransactionIds: number[] = [];
  const withdrawalIds: number[] = [];
  const checkoutIds: number[] = [];
  const auditLogIds: number[] = [];

  beforeAll(async () => {
    const [user] = await db
      .insert(botUsers)
      .values({
        name: `Audit Test User ${stamp}`,
        email: `audit-service-${stamp}@test.local`,
        password: "x",
        phoneNumber: "11900000000",
        adress: "Rua Teste, 1",
        pixCode: "chave-pix-teste",
        telegramUserId: `999${stamp}`,
      })
      .$returningId();
    userId = user.id;

    const [staff] = await db
      .insert(staffUsers)
      .values({
        name: "Admin",
        surname: `Teste ${stamp}`,
        email: `audit-staff-${stamp}@test.local`,
        password: "x",
      })
      .$returningId();
    staffId = staff.id;

    const [wallet] = await db.insert(wallets).values({ userId, balance: "115.00" }).$returningId();
    walletId = wallet.id;

    // Aparece: ledger é sempre "concluído".
    const [txDeposit] = await db
      .insert(walletTransactions)
      .values({
        walletId,
        userId,
        direction: "credit",
        origin: "deposit",
        amount: "100.00",
        balanceAfter: "100.00",
        idempotencyKey: `audit-${stamp}-deposit`,
        referenceId: `ref-deposit-${stamp}`,
        createdAt: new Date("2026-02-01T10:00:00Z"),
      })
      .$returningId();
    walletTransactionIds.push(txDeposit.id);

    // Aparece, e deve resolver `responsibleAdmin` via best-effort (proximidade de tempo).
    const [txAdjustment] = await db
      .insert(walletTransactions)
      .values({
        walletId,
        userId,
        direction: "credit",
        origin: "admin_adjustment",
        amount: "25.00",
        balanceAfter: "125.00",
        idempotencyKey: `audit-${stamp}-adjustment`,
        createdAt: new Date("2026-02-02T10:00:00Z"),
      })
      .$returningId();
    walletTransactionIds.push(txAdjustment.id);

    const [adjustmentLog] = await db
      .insert(auditLogs)
      .values({
        actorType: "staff_user",
        actorId: staffId,
        action: "wallet.admin_credit",
        entityType: "bot_users",
        entityId: String(userId),
        after: { amount: 25, balanceAfter: 125 },
        createdAt: new Date("2026-02-02T10:00:05Z"),
      })
      .$returningId();
    auditLogIds.push(adjustmentLog.id);

    // Aparece: withdrawal pendente (ainda em aberto), sem administrador responsável.
    const [withdrawalPending] = await db
      .insert(withdrawals)
      .values({
        userId,
        value: "10.00",
        status: "pending",
        referenceId: `wd-pending-${stamp}`,
        createdAt: new Date("2026-02-03T10:00:00Z"),
      })
      .$returningId();
    withdrawalIds.push(withdrawalPending.id);

    // Aparece, e deve resolver `responsibleAdmin` exatamente via audit_logs (withdrawal.approved).
    const [withdrawalAuthorized] = await db
      .insert(withdrawals)
      .values({
        userId,
        value: "20.00",
        status: "authorized",
        referenceId: `wd-authorized-${stamp}`,
        createdAt: new Date("2026-02-04T10:00:00Z"),
      })
      .$returningId();
    withdrawalIds.push(withdrawalAuthorized.id);

    const [approvalLog] = await db
      .insert(auditLogs)
      .values({
        actorType: "staff_user",
        actorId: staffId,
        action: "withdrawal.approved",
        entityType: "withdrawals",
        entityId: String(withdrawalAuthorized.id),
        after: { transactionId: "ext-123" },
        createdAt: new Date("2026-02-04T10:05:00Z"),
      })
      .$returningId();
    auditLogIds.push(approvalLog.id);

    // NÃO deve aparecer: saque já concluído (terminal, fora das branches pending/authorized).
    const [withdrawalSuccess] = await db
      .insert(withdrawals)
      .values({
        userId,
        value: "999.00",
        status: "success",
        referenceId: `wd-success-${stamp}`,
        createdAt: new Date("2026-02-05T10:00:00Z"),
      })
      .$returningId();
    withdrawalIds.push(withdrawalSuccess.id);

    // Aparece: checkout ainda pendente.
    const [checkoutPending] = await db
      .insert(checkouts)
      .values({
        referenceId: `ck-pending-${stamp}`,
        type: "deposit",
        value: "15.00",
        status: "PENDING",
        userId,
        createdAt: new Date("2026-02-06T10:00:00Z"),
      })
      .$returningId();
    checkoutIds.push(checkoutPending.id);

    // NÃO deve aparecer: checkout já pago (terminal, já virou crédito no ledger).
    const [checkoutPaid] = await db
      .insert(checkouts)
      .values({
        referenceId: `ck-paid-${stamp}`,
        type: "deposit",
        value: "888.00",
        status: "PAID",
        userId,
        createdAt: new Date("2026-02-07T10:00:00Z"),
      })
      .$returningId();
    checkoutIds.push(checkoutPaid.id);
  });

  afterAll(async () => {
    for (const id of auditLogIds) await db.delete(auditLogs).where(eq(auditLogs.id, id));
    for (const id of walletTransactionIds)
      await db.delete(walletTransactions).where(eq(walletTransactions.id, id));
    if (walletId) await db.delete(wallets).where(eq(wallets.id, walletId));
    for (const id of withdrawalIds) await db.delete(withdrawals).where(eq(withdrawals.id, id));
    for (const id of checkoutIds) await db.delete(checkouts).where(eq(checkouts.id, id));
    if (staffId) await db.delete(staffUsers).where(eq(staffUsers.id, staffId));
    await db.delete(botUsers).where(eq(botUsers.id, userId));
  });

  it("une as 3 fontes e exclui exatamente as 2 linhas terminais (saque success, checkout PAID)", async () => {
    const result = await list({ page: 1, limit: 20, userId });

    expect(result.pagination.total).toBe(5);
    const ids = result.data.map((row) => row.id);
    expect(ids).toContain(`wt-${walletTransactionIds[0]}`);
    expect(ids).toContain(`wt-${walletTransactionIds[1]}`);
    expect(ids).toContain(`wd-${withdrawalIds[0]}`);
    expect(ids).toContain(`wd-${withdrawalIds[1]}`);
    expect(ids).toContain(`ck-${checkoutIds[0]}`);
    expect(ids).not.toContain(`wd-${withdrawalIds[2]}`);
    expect(ids).not.toContain(`ck-${checkoutIds[1]}`);
  });

  it("ordena por createdAt desc por padrão", async () => {
    const result = await list({ page: 1, limit: 20, userId });
    const timestamps = result.data.map((row) => new Date(row.createdAt).getTime());
    expect(timestamps).toEqual([...timestamps].sort((a, b) => b - a));
  });

  it("ordena por amount pelo valor assinado (débito negativo), não pela magnitude bruta", async () => {
    const result = await list({ page: 1, limit: 20, userId, sortBy: "amount", sortDirection: "asc" });
    // Assinados: saque autorizado -20, saque pendente -10, checkout +15, ajuste +25, depósito +100.
    // Por magnitude bruta (o bug antigo) a ordem seria pendente(10), checkout(15), autorizado(20)... —
    // diferente o bastante pra expor a regressão caso volte a ordenar sem sinal.
    expect(result.data.map((row) => row.id)).toEqual([
      `wd-${withdrawalIds[1]}`,
      `wd-${withdrawalIds[0]}`,
      `ck-${checkoutIds[0]}`,
      `wt-${walletTransactionIds[1]}`,
      `wt-${walletTransactionIds[0]}`,
    ]);
  });

  it("pagina corretamente: limit=2 devolve 2 linhas, total continua refletindo todas as 5", async () => {
    const page1 = await list({ page: 1, limit: 2, userId });
    expect(page1.data).toHaveLength(2);
    expect(page1.pagination).toEqual({ page: 1, limit: 2, total: 5, totalPages: 3 });
  });

  it("filtra por status=pending: só withdrawals/checkouts em aberto, nunca wallet_transactions", async () => {
    const result = await list({ page: 1, limit: 20, userId, status: "pending" });
    expect(result.data.every((row) => row.source === "withdrawal" || row.source === "checkout")).toBe(true);
    expect(result.data).toHaveLength(3);
  });

  it("filtra por status=completed: só wallet_transactions", async () => {
    const result = await list({ page: 1, limit: 20, userId, status: "completed" });
    expect(result.data.every((row) => row.source === "wallet_transaction")).toBe(true);
    expect(result.data).toHaveLength(2);
  });

  it("filtra por type=admin_adjustment: só a linha de ajuste manual", async () => {
    const result = await list({ page: 1, limit: 20, userId, type: "admin_adjustment" });
    expect(result.data).toHaveLength(1);
    expect(result.data[0]!.id).toBe(`wt-${walletTransactionIds[1]}`);
  });

  it("filtra por minValue/maxValue sobre o valor da movimentação", async () => {
    const result = await list({ page: 1, limit: 20, userId, minValue: 15, maxValue: 25 });
    const amounts = result.data.map((row) => row.amount).sort((a, b) => a - b);
    expect(amounts).toEqual([15, 20, 25]);
  });

  it("filtra por período: só movimentações dentro do intervalo customizado", async () => {
    const result = await list({
      page: 1,
      limit: 20,
      userId,
      period: "custom",
      start: "2026-02-03",
      end: "2026-02-04",
    });
    expect(result.data).toHaveLength(2);
    expect(result.data.map((row) => row.id).sort()).toEqual(
      [`wd-${withdrawalIds[0]}`, `wd-${withdrawalIds[1]}`].sort(),
    );
  });

  it("busca por nome de usuário via 'search'", async () => {
    const result = await list({ page: 1, limit: 20, search: `Audit Test User ${stamp}` });
    expect(result.pagination.total).toBe(5);
  });

  it("cai no fallback (createdAt) quando sortBy é desconhecido, sem lançar erro", async () => {
    const result = await list({ page: 1, limit: 20, userId, sortBy: "not-a-real-column" });
    expect(result.data).toHaveLength(5);
  });

  it("administrador responsável: exato para saque aprovado, best-effort para ajuste manual, null para o resto", async () => {
    const result = await list({ page: 1, limit: 20, userId });
    const byId = new Map(result.data.map((row) => [row.id, row]));

    expect(byId.get(`wd-${withdrawalIds[1]}`)!.responsibleAdmin).toBe(`Admin Teste ${stamp}`);
    expect(byId.get(`wt-${walletTransactionIds[1]}`)!.responsibleAdmin).toBe(`Admin Teste ${stamp}`);
    expect(byId.get(`wd-${withdrawalIds[0]}`)!.responsibleAdmin).toBeNull();
    expect(byId.get(`wt-${walletTransactionIds[0]}`)!.responsibleAdmin).toBeNull();
    expect(byId.get(`ck-${checkoutIds[0]}`)!.responsibleAdmin).toBeNull();
  });

  it("gateway: Asaas (PIX) para depósito/saque, Sistema para ajuste manual", async () => {
    const result = await list({ page: 1, limit: 20, userId });
    const byId = new Map(result.data.map((row) => [row.id, row]));

    expect(byId.get(`wt-${walletTransactionIds[0]}`)!.gateway).toBe("Asaas (PIX)"); // deposit
    expect(byId.get(`wt-${walletTransactionIds[1]}`)!.gateway).toBe("Sistema"); // admin_adjustment
    expect(byId.get(`wd-${withdrawalIds[0]}`)!.gateway).toBe("Asaas (PIX)");
    expect(byId.get(`ck-${checkoutIds[0]}`)!.gateway).toBe("Asaas (PIX)");
  });

  it("recorte por userId sem correspondência (array vazio de scopedUserIds) devolve página vazia sem lançar erro", async () => {
    const result = await list({ page: 1, limit: 20 }, []);
    expect(result.data).toHaveLength(0);
    expect(result.pagination.total).toBe(0);
  });
});
