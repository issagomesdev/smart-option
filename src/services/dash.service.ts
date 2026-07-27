import { and, asc, count, desc, eq, gt, gte, inArray, lte, sql } from "drizzle-orm";
import { unionAll } from "drizzle-orm/mysql-core";
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
import { getOrSet } from "../shared/cache/cache-aside";
import { resolvePeriod, type PeriodInput, type PeriodRange } from "../shared/http/period";
import { fromCents, toCents } from "../wallet/wallet.math";
import { parseSqlDateTime } from "../infrastructure/database/sql-datetime";

export interface KpiValue {
  value: number;
  previousValue: number;
  /** Pontos percentuais quando `changeType: "percentage"`, delta bruto quando `"absolute"`. */
  change: number;
  changeType: "percentage" | "absolute";
}

export interface PendingWithdrawalsKpi extends KpiValue {
  /** Total de saques pendentes agora, sem filtro de data — o `value`/`previousValue` acima são
   * escopados ao período selecionado (quantos chegaram nesse período e ainda seguem pendentes),
   * o que pode confundir com "fila atual"; este campo existe para não esconder essa distinção. */
  currentBacklog: number;
}

export interface DashboardKpis {
  activeUsers: KpiValue;
  networkBalance: KpiValue;
  deposits: KpiValue;
  pendingWithdrawals: PendingWithdrawalsKpi;
}

export interface DashboardSummaryFilters extends PeriodInput {
  userId?: number;
  productId?: number;
}

export interface ChartPoint {
  bucket: string;
  total: number;
}

export interface RentabilidadeChart {
  granularity: "day" | "month";
  points: ChartPoint[];
}

export interface ApprovedTodayIndicator {
  count: number;
  total: number;
  /** `null` quando `total=0` (nada criado ainda hoje) — o frontend mostra "—", nunca "0%" enganoso. */
  percent: number | null;
}

export interface MovementRow {
  id: string;
  source: "wallet_transaction" | "withdrawal" | "checkout";
  kind: string;
  direction: "credit" | "debit";
  amount: number;
  status: string;
  userId: number;
  userName: string;
  referenceId: string | null;
  createdAt: Date;
}

export interface DashboardSummary {
  kpis: DashboardKpis;
  chart: RentabilidadeChart;
  approvedToday: ApprovedTodayIndicator;
  recentMovements: MovementRow[];
}

function buildPercentageKpi(value: number, previousValue: number): KpiValue {
  const change = previousValue === 0 ? 0 : ((value - previousValue) / Math.abs(previousValue)) * 100;
  return { value, previousValue, change: Math.round(change * 10) / 10, changeType: "percentage" };
}

function buildAbsoluteKpi(value: number, previousValue: number): KpiValue {
  return { value, previousValue, change: value - previousValue, changeType: "absolute" };
}

const ZERO_PERCENTAGE_KPI: KpiValue = { value: 0, previousValue: 0, change: 0, changeType: "percentage" };
const ZERO_PENDING_WITHDRAWALS_KPI: PendingWithdrawalsKpi = {
  value: 0,
  previousValue: 0,
  change: 0,
  changeType: "absolute",
  currentBacklog: 0,
};

/**
 * Resolve o recorte opcional por usuário/produto do dashboard num conjunto de `userId`s (ou `null`
 * quando não há recorte — "toda a rede"). Reaproveita a mesma resolução de produto→usuários que
 * `balance()` já fazia. Um array vazio é um resultado válido e distinto de `null`: significa "o
 * recorte pedido não bate com ninguém" (ex.: um `userId` que não tem esse `productId`) — os
 * chamadores tratam isso como "zero em tudo", sem rodar as queries de KPI à toa.
 */
async function resolveScopedUserIds(userId?: number, productId?: number): Promise<number[] | null> {
  if (!userId && !productId) return null;

  if (productId) {
    const rows = await db
      .select({ userId: userPlans.userId })
      .from(userPlans)
      .where(eq(userPlans.productId, productId));
    const productUserIds = rows.map((row) => row.userId);
    if (userId) return productUserIds.includes(userId) ? [userId] : [];
    return productUserIds;
  }

  return [userId!];
}

async function getActiveUsersKpi(range: PeriodRange, scopedUserIds: number[] | null): Promise<KpiValue> {
  if (scopedUserIds && scopedUserIds.length === 0) return ZERO_PERCENTAGE_KPI;

  const currentConditions = [eq(userPlans.status, 1)];
  if (scopedUserIds) currentConditions.push(inArray(userPlans.userId, scopedUserIds));

  const previousConditions = [
    lte(userPlans.acquiredIn, range.previousEnd),
    gt(userPlans.expiredIn, range.previousEnd),
  ];
  if (scopedUserIds) previousConditions.push(inArray(userPlans.userId, scopedUserIds));

  const [[{ total: value }], [{ total: previousValue }]] = await Promise.all([
    db
      .select({ total: count() })
      .from(userPlans)
      .where(and(...currentConditions)),
    db
      .select({ total: count() })
      .from(userPlans)
      .where(and(...previousConditions)),
  ]);

  return buildPercentageKpi(value, previousValue);
}

async function getNetworkBalanceKpi(range: PeriodRange, scopedUserIds: number[] | null): Promise<KpiValue> {
  if (scopedUserIds && scopedUserIds.length === 0) return ZERO_PERCENTAGE_KPI;

  const currentConditions = scopedUserIds ? [inArray(wallets.userId, scopedUserIds)] : [];
  const previousConditions = [lte(walletTransactions.createdAt, range.previousEnd)];
  if (scopedUserIds) previousConditions.push(inArray(walletTransactions.userId, scopedUserIds));

  const [[{ total: currentTotal }], [{ credits, debits }]] = await Promise.all([
    db
      .select({ total: sql<string>`COALESCE(SUM(${wallets.balance}), 0)` })
      .from(wallets)
      .where(currentConditions.length ? and(...currentConditions) : undefined),
    db
      .select({
        credits: sql<string>`COALESCE(SUM(CASE WHEN ${walletTransactions.direction} = 'credit' THEN ${walletTransactions.amount} ELSE 0 END), 0)`,
        debits: sql<string>`COALESCE(SUM(CASE WHEN ${walletTransactions.direction} = 'debit' THEN ${walletTransactions.amount} ELSE 0 END), 0)`,
      })
      .from(walletTransactions)
      .where(and(...previousConditions)),
  ]);

  const previousValue = Number(fromCents(toCents(credits) - toCents(debits)));
  return buildPercentageKpi(Number(currentTotal), previousValue);
}

async function getDepositsKpi(range: PeriodRange, scopedUserIds: number[] | null): Promise<KpiValue> {
  if (scopedUserIds && scopedUserIds.length === 0) return ZERO_PERCENTAGE_KPI;

  const sumForWindow = async (start: Date, end: Date): Promise<number> => {
    const conditions = [
      eq(checkouts.type, "deposit"),
      eq(checkouts.status, "PAID"),
      gte(checkouts.createdAt, start),
      lte(checkouts.createdAt, end),
    ];
    if (scopedUserIds) conditions.push(inArray(checkouts.userId, scopedUserIds));
    const [{ total }] = await db
      .select({ total: sql<string>`COALESCE(SUM(${checkouts.value}), 0)` })
      .from(checkouts)
      .where(and(...conditions));
    return Number(total);
  };

  const [value, previousValue] = await Promise.all([
    sumForWindow(range.currentStart, range.currentEnd),
    sumForWindow(range.previousStart, range.previousEnd),
  ]);

  return buildPercentageKpi(value, previousValue);
}

async function getPendingWithdrawalsKpi(
  range: PeriodRange,
  scopedUserIds: number[] | null,
): Promise<PendingWithdrawalsKpi> {
  if (scopedUserIds && scopedUserIds.length === 0) return ZERO_PENDING_WITHDRAWALS_KPI;

  const countForWindow = async (start: Date, end: Date): Promise<number> => {
    const conditions = [
      eq(withdrawals.status, "pending"),
      gte(withdrawals.createdAt, start),
      lte(withdrawals.createdAt, end),
    ];
    if (scopedUserIds) conditions.push(inArray(withdrawals.userId, scopedUserIds));
    const [{ total }] = await db
      .select({ total: count() })
      .from(withdrawals)
      .where(and(...conditions));
    return total;
  };

  const backlogConditions = [eq(withdrawals.status, "pending")];
  if (scopedUserIds) backlogConditions.push(inArray(withdrawals.userId, scopedUserIds));

  const [value, previousValue, [{ total: currentBacklog }]] = await Promise.all([
    countForWindow(range.currentStart, range.currentEnd),
    countForWindow(range.previousStart, range.previousEnd),
    db
      .select({ total: count() })
      .from(withdrawals)
      .where(and(...backlogConditions)),
  ]);

  return { ...buildAbsoluteKpi(value, previousValue), currentBacklog };
}

function formatDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatMonthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

/** Inverso de `formatDateKey`/`formatMonthKey` — construído via componentes (não `new Date(string)`)
 * para não cair na mesma ambiguidade UTC-vs-local documentada em `parseDateInput` (`shared/http/period.ts`). */
function parseBucketKey(key: string, granularity: "day" | "month"): Date {
  const parts = key.split("-").map(Number);
  const year = parts.at(0) ?? 1970;
  const month = parts.at(1) ?? 1;
  const day = granularity === "day" ? (parts.at(2) ?? 1) : 1;
  return new Date(year, month - 1, day);
}

function enumerateDayBuckets(start: Date, end: Date): string[] {
  const keys: string[] = [];
  const cursor = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const last = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  while (cursor.getTime() <= last.getTime()) {
    keys.push(formatDateKey(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return keys;
}

function enumerateMonthBuckets(start: Date, end: Date): string[] {
  const keys: string[] = [];
  const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
  const last = new Date(end.getFullYear(), end.getMonth(), 1);
  while (cursor.getTime() <= last.getTime()) {
    keys.push(formatMonthKey(cursor));
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return keys;
}

/**
 * `created_at` é `TIMESTAMP` (armazenado em UTC; a sessão do MySQL roda em UTC — `@@session.time_zone
 * = 'SYSTEM'`, servidor em UTC). `DATE_FORMAT` sozinho agruparia por dia/mês em UTC, não no fuso
 * local do processo Node (Brasília) — que é o que `enumerateDayBuckets`/`enumerateMonthBuckets` acima
 * usam e o que faz sentido para um dashboard de um negócio operando no Brasil. `DATE_ADD` desloca o
 * timestamp pelo offset local (calculado, não hardcoded, então continua correto se o processo rodar
 * em outro fuso) antes de formatar, alinhando os dois lados.
 */
function bucketExpression(column: typeof walletTransactions.createdAt, granularity: "day" | "month") {
  const offsetMinutes = -new Date().getTimezoneOffset();
  const format = granularity === "day" ? "%Y-%m-%d" : "%Y-%m";
  return sql<string>`DATE_FORMAT(DATE_ADD(${column}, INTERVAL ${offsetMinutes} MINUTE), ${format})`;
}

async function getRentabilidadeChart(
  range: PeriodRange,
  scopedUserIds: number[] | null,
): Promise<RentabilidadeChart> {
  if (scopedUserIds && scopedUserIds.length === 0) return { granularity: range.granularity, points: [] };

  const bucket = bucketExpression(walletTransactions.createdAt, range.granularity);
  const conditions = [
    eq(walletTransactions.origin, "profitability"),
    eq(walletTransactions.direction, "credit"),
    gte(walletTransactions.createdAt, range.currentStart),
    lte(walletTransactions.createdAt, range.currentEnd),
  ];
  if (scopedUserIds) conditions.push(inArray(walletTransactions.userId, scopedUserIds));

  const rows = await db
    .select({ bucket, total: sql<string>`COALESCE(SUM(${walletTransactions.amount}), 0)` })
    .from(walletTransactions)
    .where(and(...conditions))
    .groupBy(bucket)
    .orderBy(bucket);

  const totalsByBucket = new Map(rows.map((row) => [row.bucket, Number(row.total)]));

  // `range.unbounded` (period "all"): `currentStart` é a época, um sentinela de "desde sempre" —
  // enumerar baldes a partir dele geraria décadas de meses vazios antes do primeiro dado real. Sem
  // dado nenhum, o gráfico fica vazio (nada a preencher); havendo dado, ancora no primeiro balde que
  // realmente existe, e só preenche zero nos vãos DENTRO do intervalo com dado de verdade.
  const firstRow = rows.at(0);
  if (range.unbounded && !firstRow) return { granularity: range.granularity, points: [] };
  const bucketStart =
    range.unbounded && firstRow ? parseBucketKey(firstRow.bucket, range.granularity) : range.currentStart;

  const bucketKeys =
    range.granularity === "day"
      ? enumerateDayBuckets(bucketStart, range.currentEnd)
      : enumerateMonthBuckets(bucketStart, range.currentEnd);

  return {
    granularity: range.granularity,
    points: bucketKeys.map((key) => ({ bucket: key, total: totalsByBucket.get(key) ?? 0 })),
  };
}

/**
 * Sempre calendário-hoje, independente do período selecionado na tela — o próprio título do card
 * ("Solicitações aprovadas hoje") já fixa isso, então o indicador não reage ao filtro geral.
 */
async function getSolicitacoesAprovadasHoje(scopedUserIds: number[] | null): Promise<ApprovedTodayIndicator> {
  if (scopedUserIds && scopedUserIds.length === 0) return { count: 0, total: 0, percent: null };

  const today = resolvePeriod({ period: "today" });
  const baseConditions = [
    gte(checkouts.createdAt, today.currentStart),
    lte(checkouts.createdAt, today.currentEnd),
  ];
  if (scopedUserIds) baseConditions.push(inArray(checkouts.userId, scopedUserIds));

  const [[{ total: approvedCount }], [{ total: totalCount }]] = await Promise.all([
    db
      .select({ total: count() })
      .from(checkouts)
      .where(and(...baseConditions, eq(checkouts.status, "PAID"))),
    db
      .select({ total: count() })
      .from(checkouts)
      .where(and(...baseConditions)),
  ]);

  const percent = totalCount > 0 ? Math.round((approvedCount / totalCount) * 1000) / 10 : null;
  return { count: approvedCount, total: totalCount, percent };
}

/**
 * Feed unificado de movimentações — versão enxuta (sem paginação/filtros extras) do union completo
 * que `AuditService` vai expor na Fase 3. Três fontes, cada uma pré-filtrada para não duplicar
 * dinheiro já refletido em `wallet_transactions`: o ledger inteiro (sempre "concluído"), saques ainda
 * em aberto (`pending`/`authorized` — os terminais já têm espelho no ledger ou não moveram saldo) e
 * checkouts ainda em aberto (`PENDING`/`AUTHORIZED`/`IN_ANALYSIS` — `PAID` já virou crédito no ledger).
 */
async function getRecentMovements(scopedUserIds: number[] | null, limit: number): Promise<MovementRow[]> {
  if (scopedUserIds && scopedUserIds.length === 0) return [];

  const walletConditions = scopedUserIds ? [inArray(walletTransactions.userId, scopedUserIds)] : [];

  const withdrawalConditions = [inArray(withdrawals.status, ["pending", "authorized"])];
  if (scopedUserIds) withdrawalConditions.push(inArray(withdrawals.userId, scopedUserIds));

  const checkoutConditions = [inArray(checkouts.status, ["PENDING", "AUTHORIZED", "IN_ANALYSIS"])];
  if (scopedUserIds) checkoutConditions.push(inArray(checkouts.userId, scopedUserIds));

  const walletBranch = db
    .select({
      id: sql<string>`CONCAT('wt-', ${walletTransactions.id})`.as("id"),
      source: sql<string>`'wallet_transaction'`.as("source"),
      kind: sql<string>`${walletTransactions.origin}`.as("kind"),
      direction: sql<string>`${walletTransactions.direction}`.as("direction"),
      amount: sql<string>`${walletTransactions.amount}`.as("amount"),
      status: sql<string>`'concluido'`.as("status"),
      userId: sql<number>`${walletTransactions.userId}`.as("userId"),
      userName: sql<string>`${botUsers.name}`.as("userName"),
      referenceId: sql<string | null>`${walletTransactions.referenceId}`.as("referenceId"),
      createdAt: sql<string>`${walletTransactions.createdAt}`.as("createdAt"),
    })
    .from(walletTransactions)
    .innerJoin(botUsers, eq(botUsers.id, walletTransactions.userId))
    .where(walletConditions.length ? and(...walletConditions) : undefined);

  const withdrawalBranch = db
    .select({
      id: sql<string>`CONCAT('wd-', ${withdrawals.id})`.as("id"),
      source: sql<string>`'withdrawal'`.as("source"),
      kind: sql<string>`'withdrawal'`.as("kind"),
      direction: sql<string>`'debit'`.as("direction"),
      amount: sql<string>`${withdrawals.value}`.as("amount"),
      status: sql<string>`${withdrawals.status}`.as("status"),
      userId: sql<number>`${withdrawals.userId}`.as("userId"),
      userName: sql<string>`${botUsers.name}`.as("userName"),
      referenceId: sql<string | null>`${withdrawals.referenceId}`.as("referenceId"),
      createdAt: sql<string>`${withdrawals.createdAt}`.as("createdAt"),
    })
    .from(withdrawals)
    .innerJoin(botUsers, eq(botUsers.id, withdrawals.userId))
    .where(and(...withdrawalConditions));

  const checkoutBranch = db
    .select({
      id: sql<string>`CONCAT('ck-', ${checkouts.id})`.as("id"),
      source: sql<string>`'checkout'`.as("source"),
      kind: sql<string>`${checkouts.type}`.as("kind"),
      direction: sql<string>`'credit'`.as("direction"),
      amount: sql<string>`${checkouts.value}`.as("amount"),
      status: sql<string>`${checkouts.status}`.as("status"),
      userId: sql<number>`${checkouts.userId}`.as("userId"),
      userName: sql<string>`${botUsers.name}`.as("userName"),
      referenceId: sql<string | null>`${checkouts.referenceId}`.as("referenceId"),
      createdAt: sql<string>`${checkouts.createdAt}`.as("createdAt"),
    })
    .from(checkouts)
    .innerJoin(botUsers, eq(botUsers.id, checkouts.userId))
    .where(and(...checkoutConditions));

  const rows = await unionAll(walletBranch, withdrawalBranch, checkoutBranch)
    .orderBy(desc(sql`\`createdAt\``))
    .limit(limit);

  return rows.map((row) => ({
    id: row.id,
    source: row.source as MovementRow["source"],
    kind: row.kind,
    direction: row.direction as MovementRow["direction"],
    amount: Number(row.amount),
    status: row.status,
    userId: row.userId,
    userName: row.userName,
    referenceId: row.referenceId,
    createdAt: parseSqlDateTime(row.createdAt),
  }));
}

export class DashboardService {
  static async getPlans() {
    return db
      .select({ id: products.id, name: products.name })
      .from(products)
      .where(eq(products.purchaseType, "auto"))
      .orderBy(asc(products.id));
  }

  /**
   * Os 4 KPIs do novo dashboard agregado, com comparação contra o período imediatamente anterior de
   * mesmo tamanho (`resolvePeriod`). `userId`/`productId` aplicam o mesmo recorte opcional que a
   * busca por usuário/produto do dashboard antigo já fazia — reaproveitado, não reinventado.
   */
  static async getKpis(filters: DashboardSummaryFilters): Promise<DashboardKpis> {
    const range = resolvePeriod(filters);
    const scopedUserIds = await resolveScopedUserIds(filters.userId, filters.productId);

    const [activeUsers, networkBalance, deposits, pendingWithdrawals] = await Promise.all([
      getActiveUsersKpi(range, scopedUserIds),
      getNetworkBalanceKpi(range, scopedUserIds),
      getDepositsKpi(range, scopedUserIds),
      getPendingWithdrawalsKpi(range, scopedUserIds),
    ]);

    return { activeUsers, networkBalance, deposits, pendingWithdrawals };
  }

  /**
   * Agregador do dashboard v2 — KPIs, gráfico, indicador circular e as 10 movimentações mais
   * recentes numa única resposta (estilo Stripe), em vez de um endpoint por widget. Cacheado por 45s
   * (`getOrSet`): absorve trocas de aba/refetch repetido do admin sem bater no banco toda vez, numa
   * janela curta o bastante pra não esconder um depósito/saque que acabou de acontecer.
   */
  static async getSummary(filters: DashboardSummaryFilters): Promise<DashboardSummary> {
    const cacheKey = `dashboard:summary:${filters.period}:${filters.start ?? ""}:${filters.end ?? ""}:${filters.userId ?? ""}:${filters.productId ?? ""}`;

    return getOrSet(cacheKey, 45, async () => {
      const range = resolvePeriod(filters);
      const scopedUserIds = await resolveScopedUserIds(filters.userId, filters.productId);

      const [kpis, chart, approvedToday, recentMovements] = await Promise.all([
        DashboardService.getKpis(filters),
        getRentabilidadeChart(range, scopedUserIds),
        getSolicitacoesAprovadasHoje(scopedUserIds),
        getRecentMovements(scopedUserIds, 10),
      ]);

      return { kpis, chart, approvedToday, recentMovements };
    });
  }
}
