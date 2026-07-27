import { and, asc, count, eq, gte, inArray, like, lte, or, sql, type SQL } from "drizzle-orm";
import { unionAll } from "drizzle-orm/mysql-core";
import { db } from "../infrastructure/database/client";
import {
  auditLogs,
  botUsers,
  checkouts,
  staffUsers,
  walletTransactions,
  withdrawals,
} from "../infrastructure/database/schema";
import type { AuditFilters } from "../interfaces/http/dtos/audit.dto";
import { paginate, type PaginatedResult } from "../shared/http/pagination";
import { resolveSort } from "../shared/http/sorting";
import { resolvePeriod } from "../shared/http/period";
import { parseSqlDateTime } from "../infrastructure/database/sql-datetime";
import type { WalletOrigin } from "../wallet/wallet.service";

const WALLET_ORIGINS: readonly WalletOrigin[] = [
  "deposit",
  "withdrawal",
  "earnings",
  "profitability",
  "subscription",
  "tuition",
  "transfer_in",
  "transfer_out",
  "admin_adjustment",
  "diamond_tax",
];

export interface AuditMovementRow {
  id: string;
  source: "wallet_transaction" | "withdrawal" | "checkout";
  kind: string;
  direction: "credit" | "debit";
  amount: number;
  status: string;
  gateway: "Asaas (PIX)" | "Sistema";
  userId: number;
  userName: string;
  telegramUserId: string | null;
  referenceId: string | null;
  responsibleAdmin: string | null;
  observations: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/** Deriva o rótulo de gateway a partir da origem/fonte — não é uma coluna real em nenhuma tabela. */
function resolveGateway(source: AuditMovementRow["source"], kind: string): AuditMovementRow["gateway"] {
  if (source === "withdrawal" || source === "checkout") return "Asaas (PIX)";
  return kind === "deposit" || kind === "withdrawal" ? "Asaas (PIX)" : "Sistema";
}

/** `1 = 0` — usado para zerar uma branch inteira do union sem precisar montar o `unionAll` com aridade variável. */
const NEVER_MATCHES = sql`1 = 0`;

async function resolveResponsibleAdmins(
  // `createdAt` continua string bruta aqui (não convertida) de propósito — o único uso é reinjetar
  // no `TIMESTAMPDIFF` de outra query SQL (linha abaixo), uma comparação MySQL-a-MySQL que não passa
  // pela reinterpretação de fuso ambígua do `Date` do JS; converter pra `Date` só na resposta final
  // (`AuditService.list`), não aqui.
  rows: { id: string; source: string; kind: string; userId: number; createdAt: string }[],
) {
  const responsibleByCompoundId = new Map<string, string>();

  const withdrawalIds = rows
    .filter((row) => row.source === "withdrawal")
    .map((row) => Number(row.id.split("-")[1]));
  if (withdrawalIds.length > 0) {
    const approvals = await db
      .select({ entityId: auditLogs.entityId, name: staffUsers.name, surname: staffUsers.surname })
      .from(auditLogs)
      .innerJoin(staffUsers, eq(staffUsers.id, auditLogs.actorId))
      .where(
        and(
          eq(auditLogs.entityType, "withdrawals"),
          eq(auditLogs.action, "withdrawal.approved"),
          inArray(
            auditLogs.entityId,
            withdrawalIds.map((id) => String(id)),
          ),
        ),
      );
    for (const approval of approvals) {
      if (approval.entityId)
        responsibleByCompoundId.set(`wd-${approval.entityId}`, `${approval.name} ${approval.surname}`.trim());
    }
  }

  // `admin_adjustment` não tem FK para a linha de `audit_logs` que o originou — a melhor aproximação
  // possível é achar, para o mesmo usuário, o registro de ajuste manual mais próximo no tempo.
  const adjustmentRows = rows.filter(
    (row) => row.source === "wallet_transaction" && row.kind === "admin_adjustment",
  );
  await Promise.all(
    adjustmentRows.map(async (row) => {
      const [match] = await db
        .select({ name: staffUsers.name, surname: staffUsers.surname })
        .from(auditLogs)
        .innerJoin(staffUsers, eq(staffUsers.id, auditLogs.actorId))
        .where(
          and(
            eq(auditLogs.entityType, "bot_users"),
            eq(auditLogs.entityId, String(row.userId)),
            inArray(auditLogs.action, ["wallet.admin_credit", "wallet.admin_debit"]),
          ),
        )
        .orderBy(asc(sql`ABS(TIMESTAMPDIFF(SECOND, ${auditLogs.createdAt}, ${row.createdAt}))`))
        .limit(1);
      if (match) responsibleByCompoundId.set(row.id, `${match.name} ${match.surname}`.trim());
    }),
  );

  return responsibleByCompoundId;
}

function buildBranches(filters: AuditFilters, scopedUserIds: number[] | null) {
  const range = filters.period
    ? resolvePeriod({ period: filters.period, start: filters.start, end: filters.end })
    : null;
  const search = filters.search?.trim();

  const includeCompleted = filters.status !== "pending";
  const includePending = filters.status !== "completed";
  const includeWallet = includeCompleted && (!filters.type || WALLET_ORIGINS.includes(filters.type));
  const includeWithdrawal = includePending && (!filters.type || filters.type === "withdrawal");
  const includeCheckout =
    includePending && (!filters.type || filters.type === "deposit" || filters.type === "subscription");

  const walletConditions: SQL[] = [];
  if (!includeWallet) walletConditions.push(NEVER_MATCHES);
  else {
    if (filters.type) walletConditions.push(eq(walletTransactions.origin, filters.type));
    if (range)
      walletConditions.push(
        gte(walletTransactions.createdAt, range.currentStart),
        lte(walletTransactions.createdAt, range.currentEnd),
      );
    if (scopedUserIds) walletConditions.push(inArray(walletTransactions.userId, scopedUserIds));
    if (filters.userId) walletConditions.push(eq(walletTransactions.userId, filters.userId));
    if (filters.minValue !== undefined)
      walletConditions.push(gte(walletTransactions.amount, String(filters.minValue)));
    if (filters.maxValue !== undefined)
      walletConditions.push(lte(walletTransactions.amount, String(filters.maxValue)));
    if (search)
      walletConditions.push(
        or(
          like(botUsers.name, `%${search}%`),
          like(walletTransactions.referenceId, `%${search}%`),
          like(sql`CAST(${walletTransactions.id} AS CHAR)`, `%${search}%`),
        )!,
      );
  }

  const withdrawalConditions: SQL[] = [inArray(withdrawals.status, ["pending", "authorized"])];
  if (!includeWithdrawal) withdrawalConditions.push(NEVER_MATCHES);
  else {
    if (range)
      withdrawalConditions.push(
        gte(withdrawals.createdAt, range.currentStart),
        lte(withdrawals.createdAt, range.currentEnd),
      );
    if (scopedUserIds) withdrawalConditions.push(inArray(withdrawals.userId, scopedUserIds));
    if (filters.userId) withdrawalConditions.push(eq(withdrawals.userId, filters.userId));
    if (filters.minValue !== undefined)
      withdrawalConditions.push(gte(withdrawals.value, String(filters.minValue)));
    if (filters.maxValue !== undefined)
      withdrawalConditions.push(lte(withdrawals.value, String(filters.maxValue)));
    if (search)
      withdrawalConditions.push(
        or(
          like(botUsers.name, `%${search}%`),
          like(withdrawals.referenceId, `%${search}%`),
          like(sql`CAST(${withdrawals.id} AS CHAR)`, `%${search}%`),
        )!,
      );
  }

  const checkoutConditions: SQL[] = [inArray(checkouts.status, ["PENDING", "AUTHORIZED", "IN_ANALYSIS"])];
  if (!includeCheckout) checkoutConditions.push(NEVER_MATCHES);
  else {
    if (filters.type) checkoutConditions.push(eq(checkouts.type, filters.type as "deposit" | "subscription"));
    if (range)
      checkoutConditions.push(
        gte(checkouts.createdAt, range.currentStart),
        lte(checkouts.createdAt, range.currentEnd),
      );
    if (scopedUserIds) checkoutConditions.push(inArray(checkouts.userId, scopedUserIds));
    if (filters.userId) checkoutConditions.push(eq(checkouts.userId, filters.userId));
    if (filters.minValue !== undefined)
      checkoutConditions.push(gte(checkouts.value, String(filters.minValue)));
    if (filters.maxValue !== undefined)
      checkoutConditions.push(lte(checkouts.value, String(filters.maxValue)));
    if (search)
      checkoutConditions.push(
        or(
          like(botUsers.name, `%${search}%`),
          like(checkouts.referenceId, `%${search}%`),
          like(sql`CAST(${checkouts.id} AS CHAR)`, `%${search}%`),
        )!,
      );
  }

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
      telegramUserId: sql<string | null>`${botUsers.telegramUserId}`.as("telegramUserId"),
      referenceId: sql<string | null>`${walletTransactions.referenceId}`.as("referenceId"),
      createdAt: sql<string>`${walletTransactions.createdAt}`.as("createdAt"),
      updatedAt: sql<string>`${walletTransactions.createdAt}`.as("updatedAt"),
    })
    .from(walletTransactions)
    .innerJoin(botUsers, eq(botUsers.id, walletTransactions.userId))
    .where(and(...walletConditions));

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
      telegramUserId: sql<string | null>`${botUsers.telegramUserId}`.as("telegramUserId"),
      referenceId: sql<string | null>`${withdrawals.referenceId}`.as("referenceId"),
      createdAt: sql<string>`${withdrawals.createdAt}`.as("createdAt"),
      updatedAt: sql<string>`${withdrawals.createdAt}`.as("updatedAt"),
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
      telegramUserId: sql<string | null>`${botUsers.telegramUserId}`.as("telegramUserId"),
      referenceId: sql<string | null>`${checkouts.referenceId}`.as("referenceId"),
      createdAt: sql<string>`${checkouts.createdAt}`.as("createdAt"),
      updatedAt: sql<string>`${checkouts.createdAt}`.as("updatedAt"),
    })
    .from(checkouts)
    .innerJoin(botUsers, eq(botUsers.id, checkouts.userId))
    .where(and(...checkoutConditions));

  return [walletBranch, withdrawalBranch, checkoutBranch] as const;
}

const SORT_COLUMNS = {
  createdAt: sql`\`createdAt\``,
  // `amount` na união é sempre a magnitude bruta (débito e crédito não têm sinal na origem); ordenar
  // por ela direto misturaria um saque de R$150 antes de um rendimento de R$0,72. A UI mostra o valor
  // assinado (débito negativo), então a ordenação segue a mesma convenção do que a tela exibe.
  amount: sql`(CASE WHEN \`direction\` = 'debit' THEN -\`amount\` ELSE \`amount\` END)`,
  userName: sql`\`userName\``,
};

export class AuditService {
  /**
   * Histórico completo e filtrável de movimentações financeiras (`wallet_transactions` +
   * saques/checkouts ainda em aberto), a mesma estratégia de `unionAll` de 3 branches usada no
   * feed enxuto do dashboard (`DashboardService.getRecentMovements`), agora com paginação, filtros
   * completos e enriquecimento de "administrador responsável". Nunca cacheado — um histórico de
   * auditoria precisa refletir o estado real a cada consulta.
   */
  static async list(
    filters: AuditFilters,
    scopedUserIds: number[] | null = null,
  ): Promise<PaginatedResult<AuditMovementRow>> {
    if (scopedUserIds && scopedUserIds.length === 0) return paginate([], filters, 0);

    const [dataBranches, countBranches] = [
      buildBranches(filters, scopedUserIds),
      buildBranches(filters, scopedUserIds),
    ];

    // `resolveSort` cai em `asc` quando `sortDirection` está ausente — certo como default genérico,
    // errado para um histórico de auditoria ("mais recente primeiro" é a expectativa óbvia). O DTO já
    // aplica esse default na borda HTTP; fixamos de novo aqui pra `list` ficar correto mesmo chamado
    // direto (como os testes de integração fazem), sem depender da camada de validação.
    const orderExpr = resolveSort(
      SORT_COLUMNS,
      { ...filters, sortDirection: filters.sortDirection ?? "desc" },
      SORT_COLUMNS.createdAt,
    );

    const [rawRows, [{ total }]] = await Promise.all([
      unionAll(...dataBranches)
        .orderBy(orderExpr)
        .limit(filters.limit)
        .offset((filters.page - 1) * filters.limit),
      db.select({ total: count() }).from(unionAll(...countBranches).as("counted")),
    ]);

    const responsibleByCompoundId = await resolveResponsibleAdmins(rawRows);

    const rows: AuditMovementRow[] = rawRows.map((row) => ({
      id: row.id,
      source: row.source as AuditMovementRow["source"],
      kind: row.kind,
      direction: row.direction as AuditMovementRow["direction"],
      amount: Number(row.amount),
      status: row.status,
      gateway: resolveGateway(row.source as AuditMovementRow["source"], row.kind),
      userId: row.userId,
      userName: row.userName,
      telegramUserId: row.telegramUserId,
      referenceId: row.referenceId,
      responsibleAdmin: responsibleByCompoundId.get(row.id) ?? null,
      observations: null,
      createdAt: parseSqlDateTime(row.createdAt),
      updatedAt: parseSqlDateTime(row.updatedAt),
    }));

    return paginate(rows, filters, total);
  }
}
