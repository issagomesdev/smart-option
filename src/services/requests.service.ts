import { and, eq, like, sql } from "drizzle-orm";
import moment from "moment";
import { paymentService } from "../payments/payment.service";
import { ExternalServiceError, NotFoundError } from "../shared/errors";
import { walletService } from "../wallet/wallet.service";
import { db } from "../infrastructure/database/client";
import {
  botUsers,
  checkouts,
  products,
  supportRequests as supportRequestsTable,
  userPlans,
  walletTransactions,
  withdrawals,
} from "../infrastructure/database/schema";

/** Mesmo formato que `balance` (a tabela legada) expunha — preserva o contrato do painel admin. */
function toLegacyLedgerShape(row: typeof walletTransactions.$inferSelect) {
  const legacyOrigin =
    row.origin === "transfer_in" || row.origin === "transfer_out"
      ? "transfer"
      : row.origin === "admin_adjustment"
        ? "admin"
        : row.origin;

  return {
    id: row.id,
    type: row.direction === "credit" ? "sum" : "subtract",
    value: row.amount,
    origin: legacyOrigin,
    reference_id: row.referenceId,
    created_at: moment(row.createdAt).format("DD/MM/YYYY HH:mm"),
  };
}

const ORIGIN_FILTER_MAP: Record<string, { origin?: string; direction?: "credit" | "debit" }> = {
  deposit: { origin: "deposit" },
  withdrawal: { origin: "withdrawal" },
  subscription: { origin: "subscription", direction: "debit" },
  tuition: { origin: "tuition", direction: "debit" },
  earnings: { origin: "earnings" },
  profitability: { origin: "profitability" },
  admin: { origin: "admin_adjustment" },
  "B.A": { origin: "subscription", direction: "credit" },
  "B.M": { origin: "tuition", direction: "credit" },
};

interface ListFilters {
  id?: string;
  name?: string;
  value?: string;
  status?: string;
  product_id?: string;
  type?: string;
  is_read?: string;
  created_at?: string;
}

function createdAtFilter(column: any, createdAt?: string) {
  return createdAt ? like(sql`CAST(${column} AS CHAR)`, `%${createdAt.replace("T", " ")}%`) : undefined;
}

export class RequestService {
  static async balance(userId: number) {
    return walletService.getBalance(userId);
  }

  static async extract(userId: number, filters: any = null) {
    const conditions = [eq(walletTransactions.userId, userId)];

    if (filters?.value) {
      if (filters.value.includes("+")) conditions.push(eq(walletTransactions.direction, "credit"));
      else if (filters.value.includes("-")) conditions.push(eq(walletTransactions.direction, "debit"));

      const numericMatch = filters.value.match(/\d+(\.\d+)?/);
      if (numericMatch) {
        conditions.push(sql`CAST(${walletTransactions.amount} AS CHAR) LIKE ${`%${numericMatch[0]}%`}`);
      }
    }

    if (filters?.origin && filters.origin !== "all" && ORIGIN_FILTER_MAP[filters.origin]) {
      const { origin, direction } = ORIGIN_FILTER_MAP[filters.origin];
      if (origin) conditions.push(eq(walletTransactions.origin, origin as never));
      if (direction) conditions.push(eq(walletTransactions.direction, direction));
    }

    if (filters?.created_at) {
      conditions.push(
        sql`LOWER(CAST(${walletTransactions.createdAt} AS CHAR)) LIKE LOWER(${`%${filters.created_at.replace("T", " ")}%`})`,
      );
    }

    const rows = await db
      .select()
      .from(walletTransactions)
      .where(and(...conditions))
      .orderBy(walletTransactions.createdAt);

    return { extract: rows.map(toLegacyLedgerShape), balance: await RequestService.balance(userId) };
  }

  static async withdrawalRequests(userId: number | null = null, filters: ListFilters) {
    const conditions = [
      like(sql`CAST(${withdrawals.id} AS CHAR)`, `%${filters.id ?? ""}%`),
      like(botUsers.name, `%${filters.name ?? ""}%`),
      like(sql`CAST(${withdrawals.value} AS CHAR)`, `%${filters.value ?? ""}%`),
    ];
    if (filters.status && filters.status !== "all") conditions.push(eq(withdrawals.status, filters.status as never));
    const dateFilter = createdAtFilter(withdrawals.createdAt, filters.created_at);
    if (dateFilter) conditions.push(dateFilter);
    if (userId) conditions.push(eq(withdrawals.userId, userId));

    return db
      .select({
        id: withdrawals.id,
        user_id: withdrawals.userId,
        value: withdrawals.value,
        status: withdrawals.status,
        reply_observation: withdrawals.replyObservation,
        errors_cause: withdrawals.errorsCause,
        reference_id: withdrawals.referenceId,
        transaction_id: withdrawals.transactionId,
        created_at: sql<string>`DATE_FORMAT(${withdrawals.createdAt}, '%d/%m/%Y %H:%i')`,
        name: botUsers.name,
      })
      .from(withdrawals)
      .innerJoin(botUsers, eq(withdrawals.userId, botUsers.id))
      .where(and(...conditions))
      .orderBy(withdrawals.createdAt);
  }

  static async depositsRequests(userId: number | null = null, filters: ListFilters) {
    const conditions = [
      eq(checkouts.type, "deposit"),
      like(sql`CAST(${checkouts.id} AS CHAR)`, `%${filters.id ?? ""}%`),
      like(botUsers.name, `%${filters.name ?? ""}%`),
      like(sql`CAST(${checkouts.value} AS CHAR)`, `%${filters.value ?? ""}%`),
    ];
    if (filters.status && filters.status !== "all") conditions.push(eq(checkouts.status, filters.status as never));
    const dateFilter = createdAtFilter(checkouts.createdAt, filters.created_at);
    if (dateFilter) conditions.push(dateFilter);
    if (userId) conditions.push(eq(checkouts.userId, userId));

    return db
      .select({
        id: checkouts.id,
        reference_id: checkouts.referenceId,
        type: checkouts.type,
        value: checkouts.value,
        status: checkouts.status,
        transaction_id: checkouts.transactionId,
        user_id: checkouts.userId,
        created_at: sql<string>`DATE_FORMAT(${checkouts.createdAt}, '%d/%m/%Y %H:%i')`,
        name: botUsers.name,
      })
      .from(checkouts)
      .innerJoin(botUsers, eq(checkouts.userId, botUsers.id))
      .where(and(...conditions))
      .orderBy(checkouts.createdAt);
  }

  static async subscriptionsRequests(userId: number | null = null, filters: ListFilters) {
    const conditions = [
      eq(checkouts.type, "subscription"),
      like(sql`CAST(${checkouts.id} AS CHAR)`, `%${filters.id ?? ""}%`),
      like(botUsers.name, `%${filters.name ?? ""}%`),
      like(sql`CAST(${checkouts.value} AS CHAR)`, `%${filters.value ?? ""}%`),
    ];
    if (filters.status && filters.status !== "all") conditions.push(eq(checkouts.status, filters.status as never));
    if (filters.product_id && filters.product_id !== "all") conditions.push(eq(checkouts.productId, Number(filters.product_id)));
    const dateFilter = createdAtFilter(checkouts.createdAt, filters.created_at);
    if (dateFilter) conditions.push(dateFilter);
    if (userId) conditions.push(eq(checkouts.userId, userId));

    return db
      .select({
        id: checkouts.id,
        reference_id: checkouts.referenceId,
        type: checkouts.type,
        value: checkouts.value,
        status: checkouts.status,
        transaction_id: checkouts.transactionId,
        user_id: checkouts.userId,
        created_at: sql<string>`DATE_FORMAT(${checkouts.createdAt}, '%d/%m/%Y %H:%i')`,
        name: botUsers.name,
        product: products.name,
      })
      .from(checkouts)
      .innerJoin(botUsers, eq(checkouts.userId, botUsers.id))
      .leftJoin(products, eq(products.id, checkouts.productId))
      .where(and(...conditions))
      .orderBy(checkouts.createdAt);
  }

  static async supportRequests(userId: number | null = null, filters: ListFilters) {
    const conditions = [
      like(sql`CAST(${supportRequestsTable.id} AS CHAR)`, `%${filters.id ?? ""}%`),
      like(botUsers.name, `%${filters.name ?? ""}%`),
    ];
    if (filters.type && filters.type !== "all") conditions.push(eq(supportRequestsTable.type, filters.type as never));
    if (filters.is_read !== undefined && filters.is_read !== "all") conditions.push(eq(supportRequestsTable.isRead, Number(filters.is_read)));
    const dateFilter = createdAtFilter(supportRequestsTable.createdAt, filters.created_at);
    if (dateFilter) conditions.push(dateFilter);
    if (userId) conditions.push(eq(supportRequestsTable.userId, userId));

    return db
      .select({
        id: supportRequestsTable.id,
        type: supportRequestsTable.type,
        subject: supportRequestsTable.subject,
        is_read: supportRequestsTable.isRead,
        user_id: botUsers.id,
        created_at: sql<string>`DATE_FORMAT(${supportRequestsTable.createdAt}, '%d/%m/%Y %H:%i')`,
        name: botUsers.name,
      })
      .from(supportRequestsTable)
      .innerJoin(botUsers, eq(supportRequestsTable.userId, botUsers.id))
      .where(and(...conditions))
      .orderBy(supportRequestsTable.createdAt);
  }

  static async resWithdrawal(body: { res: boolean; id: number; observation?: string }) {
    if (body.res) {
      const [withdrawal] = await db.select().from(withdrawals).where(eq(withdrawals.id, body.id));
      if (!withdrawal) throw new NotFoundError("Solicitação de saque não encontrada");

      const [user] = await db.select({ id: botUsers.id, pixCode: botUsers.pixCode }).from(botUsers).where(eq(botUsers.id, withdrawal.userId));
      if (!user) throw new NotFoundError("Usuário não encontrado");

      try {
        const transfer = await paymentService.createWithdrawalTransfer(
          { id: user.id },
          {
            userId: user.id,
            amount: parseFloat(withdrawal.value),
            pixKey: user.pixCode,
            description: `SMART OPTION E.A. Saque #${withdrawal.id}`,
            legacyReferenceId: String(withdrawal.id),
          },
        );

        await db
          .update(withdrawals)
          .set({ status: "authorized", replyObservation: body.observation, transactionId: transfer.externalId })
          .where(eq(withdrawals.id, body.id));

        return { status: true, message: "Solicitação respondida com sucesso!" };
      } catch (error) {
        return {
          status: false,
          message: error instanceof ExternalServiceError ? error.message : "Falha ao processar a transferência PIX.",
        };
      }
    }

    await db.update(withdrawals).set({ status: "refused", replyObservation: body.observation }).where(eq(withdrawals.id, body.id));
    return { status: true, message: "Solicitação respondida com sucesso!" };
  }

  static async finishWithdrawal(body: { reference_id: string; status: string; error_messages?: unknown }) {
    const [withdrawal] = await db.select().from(withdrawals).where(eq(withdrawals.id, Number(body.reference_id)));
    if (!withdrawal) return;

    const newStatus = body.status.toLowerCase() as (typeof withdrawals.status.enumValues)[number];

    if (body.status === "SUCCESS") {
      if (withdrawal.status === newStatus) return;

      await db.update(withdrawals).set({ status: newStatus }).where(eq(withdrawals.id, withdrawal.id));

      // `allowNegative: true` de propósito: neste ponto o PIX já foi enviado
      // pela Asaas (dinheiro já saiu de verdade) — recusar o débito por saldo
      // insuficiente aqui só esconderia a inconsistência em vez de registrá-la.
      await walletService.debit({
        userId: withdrawal.userId,
        amount: parseFloat(withdrawal.value),
        origin: "withdrawal",
        idempotencyKey: `withdrawal:${withdrawal.id}`,
        referenceType: "withdrawals",
        referenceId: String(withdrawal.id),
        allowNegative: true,
      });

      const [hasPlan] = await db
        .select({ productId: userPlans.productId })
        .from(userPlans)
        .where(and(eq(userPlans.userId, withdrawal.userId), eq(userPlans.status, 1)));

      const balance = await RequestService.balance(withdrawal.userId);
      const tierUpdate = { status: 1 as const, acquiredIn: new Date(), expiredIn: moment().add(1, "months").toDate() };

      if (hasPlan && hasPlan.productId !== 4 && balance >= 20000) {
        await db.update(userPlans).set({ ...tierUpdate, productId: 4 }).where(eq(userPlans.userId, withdrawal.userId));
      }
      if (hasPlan && hasPlan.productId === 4 && balance < 20000) {
        await db.update(userPlans).set({ ...tierUpdate, productId: 3 }).where(eq(userPlans.userId, withdrawal.userId));
      }
    } else {
      await db
        .update(withdrawals)
        .set({ status: newStatus, errorsCause: JSON.stringify(body.error_messages) })
        .where(eq(withdrawals.id, withdrawal.id));
    }
  }

  static async wasRead(id: string, status: string) {
    await db.update(supportRequestsTable).set({ isRead: Number(status) }).where(eq(supportRequestsTable.id, Number(id)));
    return { status: true, message: "Solicitação atualizado com sucesso" };
  }

  static async pendingRequests() {
    const [{ pendingWithdrawals }] = await db
      .select({ pendingWithdrawals: sql<number>`count(*)` })
      .from(withdrawals)
      .where(eq(withdrawals.status, "pending"));

    const [{ unreadSupport }] = await db
      .select({ unreadSupport: sql<number>`count(*)` })
      .from(supportRequestsTable)
      .where(eq(supportRequestsTable.isRead, 0));

    return [
      { requests: "withdrawals", pendings: pendingWithdrawals },
      { requests: "support", pendings: unreadSupport },
    ];
  }
}
