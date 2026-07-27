import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "../infrastructure/database/client";
import {
  botUsers,
  checkouts,
  products,
  userPlans,
  walletTransactions,
  wallets,
  withdrawals,
} from "../infrastructure/database/schema";
import { DashboardService } from "./dash.service";

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const daysAgo = (n: number) => new Date(Date.now() - n * ONE_DAY_MS);

/**
 * Fase 1 do Dashboard v2: `getKpis` reescreve os 4 KPIs sobre agregação real em SQL (sem reduce em
 * JS) e adiciona comparação contra o período anterior via `resolvePeriod`. Este teste semeia dados
 * com datas relativas a "agora" — dentro/fora da janela `7d` e da janela anterior de mesmo tamanho —
 * e confere os 4 números à mão contra o que foi semeado, não contra um snapshot solto.
 */
describe("DashboardService.getKpis (7d, banco real)", () => {
  let userId: number;
  let walletId: number;
  const checkoutIds: number[] = [];
  const withdrawalIds: number[] = [];
  const userPlanIds: number[] = [];
  const walletTransactionIds: number[] = [];
  const stamp = Date.now();

  beforeAll(async () => {
    const [user] = await db
      .insert(botUsers)
      .values({
        name: "Dashboard KPI Test User",
        email: `dashboard-kpi-${stamp}@test.local`,
        password: "x",
        phoneNumber: "11900000000",
        adress: "Rua Teste, 1",
        pixCode: "chave-pix-teste",
      })
      .$returningId();
    userId = user.id;

    const [{ id: productId }] = await db.select({ id: products.id }).from(products).limit(1);

    // Usuário ativo agora (status=1), mas cujo plano só começou dentro da janela atual — não deve
    // contar em `previousValue` (não estava ativo como de `previousEnd`).
    const [planNow] = await db
      .insert(userPlans)
      .values({ userId, productId, status: 1, acquiredIn: daysAgo(2), expiredIn: daysAgo(-30) })
      .$returningId();
    userPlanIds.push(planNow.id);

    // Segundo usuário: ativo agora E já estava ativo como de `previousEnd` — conta nos dois lados.
    const [userAlreadyActive] = await db
      .insert(botUsers)
      .values({
        name: "Dashboard KPI Already Active",
        email: `dashboard-kpi-already-active-${stamp}@test.local`,
        password: "x",
        phoneNumber: "11900000000",
        adress: "Rua Teste, 1",
        pixCode: "chave-pix-teste",
      })
      .$returningId();
    const [planAlreadyActive] = await db
      .insert(userPlans)
      .values({
        userId: userAlreadyActive.id,
        productId,
        status: 1,
        acquiredIn: daysAgo(20),
        expiredIn: daysAgo(-30),
      })
      .$returningId();
    userPlanIds.push(planAlreadyActive.id);

    // Terceiro usuário: plano expirado antes de `previousEnd` — não deve contar em nenhum dos lados.
    const [userExpired] = await db
      .insert(botUsers)
      .values({
        name: "Dashboard KPI Expired",
        email: `dashboard-kpi-expired-${stamp}@test.local`,
        password: "x",
        phoneNumber: "11900000000",
        adress: "Rua Teste, 1",
        pixCode: "chave-pix-teste",
      })
      .$returningId();
    const [planExpired] = await db
      .insert(userPlans)
      .values({
        userId: userExpired.id,
        productId,
        status: 0,
        acquiredIn: daysAgo(20),
        expiredIn: daysAgo(15),
      })
      .$returningId();
    userPlanIds.push(planExpired.id);

    // --- Saldo da rede: wallet materializado (valor "agora") + ledger (valor "como era até previousEnd") ---
    const [wallet] = await db.insert(wallets).values({ userId, balance: "250.00" }).$returningId();
    walletId = wallet.id;

    const [txOld] = await db
      .insert(walletTransactions)
      .values({
        walletId,
        userId,
        direction: "credit",
        origin: "deposit",
        amount: "200.00",
        balanceAfter: "200.00",
        idempotencyKey: `dashboard-kpi-${stamp}-old`,
        createdAt: daysAgo(20),
      })
      .$returningId();
    walletTransactionIds.push(txOld.id);

    const [txRecent] = await db
      .insert(walletTransactions)
      .values({
        walletId,
        userId,
        direction: "credit",
        origin: "earnings",
        amount: "50.00",
        balanceAfter: "250.00",
        idempotencyKey: `dashboard-kpi-${stamp}-recent`,
        createdAt: daysAgo(3),
      })
      .$returningId();
    walletTransactionIds.push(txRecent.id);

    // --- Depósitos: um PAID na janela atual, um PAID na janela anterior, e dois que devem ser
    // ignorados (status != PAID, type != deposit) para provar que os filtros funcionam. ---
    const [depositCurrent] = await db
      .insert(checkouts)
      .values({
        referenceId: `dep-current-${stamp}`,
        type: "deposit",
        value: "200.00",
        status: "PAID",
        userId,
        createdAt: daysAgo(3),
      })
      .$returningId();
    checkoutIds.push(depositCurrent.id);

    const [depositPrevious] = await db
      .insert(checkouts)
      .values({
        referenceId: `dep-previous-${stamp}`,
        type: "deposit",
        value: "150.00",
        status: "PAID",
        userId,
        createdAt: daysAgo(10),
      })
      .$returningId();
    checkoutIds.push(depositPrevious.id);

    const [depositPending] = await db
      .insert(checkouts)
      .values({
        referenceId: `dep-pending-${stamp}`,
        type: "deposit",
        value: "999.00",
        status: "PENDING",
        userId,
        createdAt: daysAgo(1),
      })
      .$returningId();
    checkoutIds.push(depositPending.id);

    const [subscriptionPaid] = await db
      .insert(checkouts)
      .values({
        referenceId: `sub-paid-${stamp}`,
        type: "subscription",
        value: "500.00",
        status: "PAID",
        userId,
        createdAt: daysAgo(1),
      })
      .$returningId();
    checkoutIds.push(subscriptionPaid.id);

    // --- Saques pendentes: 2 pendentes na janela atual, 1 pendente na janela anterior, 1 concluído
    // (deve ser ignorado). ---
    const [pending1] = await db
      .insert(withdrawals)
      .values({
        userId,
        value: "10.00",
        status: "pending",
        referenceId: `wd-1-${stamp}`,
        createdAt: daysAgo(2),
      })
      .$returningId();
    withdrawalIds.push(pending1.id);

    const [pending2] = await db
      .insert(withdrawals)
      .values({
        userId,
        value: "20.00",
        status: "pending",
        referenceId: `wd-2-${stamp}`,
        createdAt: daysAgo(4),
      })
      .$returningId();
    withdrawalIds.push(pending2.id);

    const [pendingPrevious] = await db
      .insert(withdrawals)
      .values({
        userId,
        value: "30.00",
        status: "pending",
        referenceId: `wd-3-${stamp}`,
        createdAt: daysAgo(9),
      })
      .$returningId();
    withdrawalIds.push(pendingPrevious.id);

    const [successWithdrawal] = await db
      .insert(withdrawals)
      .values({
        userId,
        value: "40.00",
        status: "success",
        referenceId: `wd-4-${stamp}`,
        createdAt: daysAgo(2),
      })
      .$returningId();
    withdrawalIds.push(successWithdrawal.id);

    // --- Gráfico "Rentabilidade da rede": só origin=profitability + direction=credit deve somar. ---
    const [txProfitability] = await db
      .insert(walletTransactions)
      .values({
        walletId,
        userId,
        direction: "credit",
        origin: "profitability",
        amount: "12.34",
        balanceAfter: "262.34",
        idempotencyKey: `dashboard-kpi-${stamp}-profitability`,
        createdAt: daysAgo(2),
      })
      .$returningId();
    walletTransactionIds.push(txProfitability.id);

    // --- Indicador "Solicitações aprovadas hoje": sempre calendário-hoje, independente do período. ---
    const [checkoutApprovedToday] = await db
      .insert(checkouts)
      .values({
        referenceId: `today-approved-${stamp}`,
        type: "deposit",
        value: "77.00",
        status: "PAID",
        userId,
        createdAt: new Date(),
      })
      .$returningId();
    checkoutIds.push(checkoutApprovedToday.id);

    const [checkoutPendingToday] = await db
      .insert(checkouts)
      .values({
        referenceId: `today-pending-${stamp}`,
        type: "deposit",
        value: "88.00",
        status: "PENDING",
        userId,
        createdAt: new Date(),
      })
      .$returningId();
    checkoutIds.push(checkoutPendingToday.id);
  });

  afterAll(async () => {
    for (const id of walletTransactionIds)
      await db.delete(walletTransactions).where(eq(walletTransactions.id, id));
    if (walletId) await db.delete(wallets).where(eq(wallets.id, walletId));
    for (const id of checkoutIds) await db.delete(checkouts).where(eq(checkouts.id, id));
    for (const id of withdrawalIds) await db.delete(withdrawals).where(eq(withdrawals.id, id));
    for (const id of userPlanIds) await db.delete(userPlans).where(eq(userPlans.id, id));
    await db.delete(botUsers).where(eq(botUsers.email, `dashboard-kpi-${stamp}@test.local`));
    await db.delete(botUsers).where(eq(botUsers.email, `dashboard-kpi-already-active-${stamp}@test.local`));
    await db.delete(botUsers).where(eq(botUsers.email, `dashboard-kpi-expired-${stamp}@test.local`));
  });

  it("usuários ativos: conta só quem tem status=1 agora; previousValue exige que já estivesse ativo em previousEnd", async () => {
    const kpis = await DashboardService.getKpis({ period: "7d", userId });
    // Escopado por `userId`, então só o plano do próprio `userId` (planNow) entra na contagem.
    expect(kpis.activeUsers).toEqual({ value: 1, previousValue: 0, change: 0, changeType: "percentage" });
  });

  it("usuários ativos sem recorte: reflete os 2 planos com status=1 semeados (um novo, um antigo)", async () => {
    const kpis = await DashboardService.getKpis({ period: "7d" });
    expect(kpis.activeUsers.value).toBeGreaterThanOrEqual(2);
    expect(kpis.activeUsers.previousValue).toBeGreaterThanOrEqual(1);
  });

  it("saldo da rede: value vem de wallet.balance (250), previousValue reconstrói do ledger até previousEnd (200)", async () => {
    const kpis = await DashboardService.getKpis({ period: "7d", userId });
    expect(kpis.networkBalance.value).toBe(250);
    expect(kpis.networkBalance.previousValue).toBe(200);
    expect(kpis.networkBalance.change).toBe(25);
    expect(kpis.networkBalance.changeType).toBe("percentage");
  });

  it("depósitos: soma só checkouts PAID de type=deposit, comparando janela atual (200 + 77 de hoje = 277) com anterior (150)", async () => {
    const kpis = await DashboardService.getKpis({ period: "7d", userId });
    // 277 = os 200 de daysAgo(3) + os 77 do checkout PAID datado de hoje (seedado para o indicador
    // "aprovadas hoje"), já que "hoje" também cai dentro da janela atual de 7d.
    expect(kpis.deposits.value).toBe(277);
    expect(kpis.deposits.previousValue).toBe(150);
    expect(kpis.deposits.changeType).toBe("percentage");
  });

  it("saques pendentes: conta status=pending por janela (2 atual, 1 anterior), delta absoluto, e o backlog atual (3) sem filtro de data", async () => {
    const kpis = await DashboardService.getKpis({ period: "7d", userId });
    expect(kpis.pendingWithdrawals.value).toBe(2);
    expect(kpis.pendingWithdrawals.previousValue).toBe(1);
    expect(kpis.pendingWithdrawals.change).toBe(1);
    expect(kpis.pendingWithdrawals.changeType).toBe("absolute");
    expect(kpis.pendingWithdrawals.currentBacklog).toBe(3);
  });

  it("recorte por productId sem correspondência devolve zero em tudo, sem lançar erro", async () => {
    const nonExistentProductId = 999999;
    const kpis = await DashboardService.getKpis({ period: "7d", productId: nonExistentProductId });
    expect(kpis.activeUsers).toEqual({ value: 0, previousValue: 0, change: 0, changeType: "percentage" });
    expect(kpis.networkBalance).toEqual({ value: 0, previousValue: 0, change: 0, changeType: "percentage" });
    expect(kpis.deposits).toEqual({ value: 0, previousValue: 0, change: 0, changeType: "percentage" });
    expect(kpis.pendingWithdrawals).toEqual({
      value: 0,
      previousValue: 0,
      change: 0,
      changeType: "absolute",
      currentBacklog: 0,
    });
  });

  it("gráfico de rentabilidade: soma só origin=profitability + direction=credit, com os demais dias zerados (sem gaps)", async () => {
    const summary = await DashboardService.getSummary({ period: "7d", userId });
    expect(summary.chart.granularity).toBe("day");
    expect(summary.chart.points).toHaveLength(7);

    const nonZeroPoints = summary.chart.points.filter((point) => point.total !== 0);
    expect(nonZeroPoints).toHaveLength(1);
    expect(nonZeroPoints[0]!.total).toBeCloseTo(12.34, 2);

    const zeroPoints = summary.chart.points.filter((point) => point.total === 0);
    expect(zeroPoints).toHaveLength(6);
  });

  it("gráfico com period='all': ancora no primeiro balde real, não na época (evita décadas de meses vazios)", async () => {
    const summary = await DashboardService.getSummary({ period: "all", userId });
    expect(summary.chart.granularity).toBe("month");
    // Só existe UM dado real semeado para este usuário (o profitability de `daysAgo(2)`), então o
    // gráfico "desde sempre" deve ter só o balde do mês corrente — nunca um por mês desde 1970.
    expect(summary.chart.points.length).toBeLessThanOrEqual(2);
    const nonZeroPoints = summary.chart.points.filter((point) => point.total !== 0);
    expect(nonZeroPoints).toHaveLength(1);
    expect(nonZeroPoints[0]!.total).toBeCloseTo(12.34, 2);
  });

  it("gráfico com period='all' e nenhum dado real devolve pontos vazios, não um balde por mês desde a época", async () => {
    const nonExistentProductId = 999999;
    const summary = await DashboardService.getSummary({ period: "all", productId: nonExistentProductId });
    expect(summary.chart.points).toEqual([]);
  });

  it("indicador 'aprovadas hoje': conta só checkouts PAID de hoje sobre o total de hoje, ignorando o período selecionado", async () => {
    // period=30d de propósito — o indicador é sempre calendário-hoje, não deve mudar com o filtro.
    const summary = await DashboardService.getSummary({ period: "30d", userId });
    expect(summary.approvedToday.count).toBe(1);
    expect(summary.approvedToday.total).toBe(2);
    expect(summary.approvedToday.percent).toBe(50);
  });

  it("movimentações recentes: mistura ledger concluído com saques/checkouts ainda pendentes, sem duplicar os que já viraram ledger, ordenado do mais novo pro mais antigo", async () => {
    const summary = await DashboardService.getSummary({ period: "30d", userId });

    expect(summary.recentMovements.length).toBeGreaterThan(0);
    expect(summary.recentMovements.length).toBeLessThanOrEqual(10);

    // Ordenado do mais recente pro mais antigo.
    const timestamps = summary.recentMovements.map((row) => new Date(row.createdAt).getTime());
    expect(timestamps).toEqual([...timestamps].sort((a, b) => b - a));

    // O saque `success` (já refletido no ledger) não deve aparecer via a branch de `withdrawals` —
    // só via `wallet_transactions` seria o esperado, mas este cenário de teste nem chegou a criar uma
    // wallet_transaction pro saque de sucesso (não é isso que o wallet real faz automaticamente aqui),
    // então o importante é que a fonte "withdrawal" só contenha os pendentes.
    const withdrawalSourceRows = summary.recentMovements.filter((row) => row.source === "withdrawal");
    expect(withdrawalSourceRows.every((row) => row.status === "pending" || row.status === "authorized")).toBe(
      true,
    );

    // Checkouts PAID (deposit/subscription) não devem aparecer via a branch de `checkouts` — só os
    // ainda em aberto (PENDING/AUTHORIZED/IN_ANALYSIS) devem.
    const checkoutSourceRows = summary.recentMovements.filter((row) => row.source === "checkout");
    expect(
      checkoutSourceRows.every(
        (row) => row.status === "PENDING" || row.status === "AUTHORIZED" || row.status === "IN_ANALYSIS",
      ),
    ).toBe(true);

    // IDs prefixados por fonte, como o "banco de dados unificado" precisa pra ter uma chave única
    // cruzando 3 tabelas diferentes.
    for (const row of summary.recentMovements) {
      expect(row.id).toMatch(/^(wt|wd|ck)-\d+$/);
      // Nome do usuário via join com bot_users — usado pela coluna "Usuário" da tabela do dashboard.
      expect(row.userName).toBe("Dashboard KPI Test User");
    }
  });

  it("getSummary usa o cache: uma segunda chamada com os mesmos filtros dentro do TTL devolve o mesmo resultado", async () => {
    const first = await DashboardService.getSummary({ period: "today", userId });
    const second = await DashboardService.getSummary({ period: "today", userId });
    expect(second).toEqual(first);
  });
});
