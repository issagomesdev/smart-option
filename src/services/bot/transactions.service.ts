import { and, eq, sql } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import moment from "moment";
import { NetworkService } from "./network.service";
import { paymentService } from "../../payments/payment.service";
import { walletService } from "../../wallet/wallet.service";
import { db } from "../../infrastructure/database/client";
import { botUsers, checkouts, products, userPlans, walletTransactions, withdrawals } from "../../infrastructure/database/schema";

/** Formato que `src/bot/views/extract.view.ts` espera. */
function toLegacyLedgerShape(row: typeof walletTransactions.$inferSelect) {
  const legacyOrigin =
    row.origin === "transfer_in" || row.origin === "transfer_out"
      ? "transfer"
      : row.origin === "admin_adjustment"
        ? "admin"
        : row.origin;

  return {
    type: row.direction === "credit" ? "sum" : "subtract",
    value: row.amount,
    origin: legacyOrigin,
    reference_id: row.referenceId,
    created_at: row.createdAt,
  };
}

interface LegacyPlanRow {
  user_id: number;
  product_id: number;
}

export class TransactionsService {
  /**
   * `user`, quando informado, tanto pode ser uma linha de `bot_users` (tem
   * `.id`) quanto uma linha de `users_plans` como o `cron.ts` ainda passa
   * (tem `.user_id`) — mesma convenção do código original, preservada aqui
   * porque o cron continua chamando este método com esse formato.
   */
  static async balance(telegramId: number | null = null, earnings: boolean = true, user: { id?: number } | LegacyPlanRow | null = null) {
    if (telegramId && !user) {
      const [row] = await db.select({ id: botUsers.id }).from(botUsers).where(eq(botUsers.telegramUserId, String(telegramId)));
      user = row;
    }

    const userId = (user as LegacyPlanRow).user_id ?? (user as { id: number }).id;

    return earnings ? walletService.getBalance(userId) : walletService.getBalanceExcludingCurrentMonthEarnings(userId);
  }

  static async extract(userId: number) {
    const [user] = await db.select({ id: botUsers.id }).from(botUsers).where(eq(botUsers.telegramUserId, String(userId)));

    const rows = await db
      .select()
      .from(walletTransactions)
      .where(eq(walletTransactions.userId, user.id))
      .orderBy(walletTransactions.createdAt);

    return rows.map(toLegacyLedgerShape);
  }

  static async checkoutsRequests(userId: number, type: "deposit" | "subscription") {
    const [user] = await db.select({ id: botUsers.id }).from(botUsers).where(eq(botUsers.telegramUserId, String(userId)));
    if (!user) return [];

    if (type === "subscription") {
      return db
        .select({ id: checkouts.id, value: checkouts.value, status: checkouts.status, created_at: checkouts.createdAt, name: products.name })
        .from(checkouts)
        .innerJoin(products, eq(products.id, checkouts.productId))
        .where(and(eq(checkouts.userId, user.id), eq(checkouts.type, type)))
        .orderBy(checkouts.createdAt);
    }

    return db
      .select({ id: checkouts.id, value: checkouts.value, status: checkouts.status, created_at: checkouts.createdAt })
      .from(checkouts)
      .where(and(eq(checkouts.userId, user.id), eq(checkouts.type, type)))
      .orderBy(checkouts.createdAt);
  }

  static async withdrawalRequests(userId: number) {
    const [user] = await db.select({ id: botUsers.id }).from(botUsers).where(eq(botUsers.telegramUserId, String(userId)));
    if (!user) return [];

    return db
      .select({ value: withdrawals.value, status: withdrawals.status, created_at: withdrawals.createdAt })
      .from(withdrawals)
      .where(eq(withdrawals.userId, user.id))
      .orderBy(withdrawals.createdAt);
  }

  static async checkout(userId: number, value: number, product: { id: number; name: string } | null = null) {
    const [user] = await db.select().from(botUsers).where(eq(botUsers.telegramUserId, String(userId)));

    const [inserted] = await db
      .insert(checkouts)
      .values({
        referenceId: uuidv4(),
        type: product ? "subscription" : "deposit",
        value: String(value),
        userId: user.id,
        productId: product?.id,
      })
      .$returningId();

    const description = product ? `SMART OPTION E.A. Plano Smart ${product.name}` : `SMART OPTION E.A. Depósito`;

    const charge = await paymentService.createPixCharge(
      {
        id: user.id,
        name: user.name,
        email: user.email,
        cpf: user.cpf,
        phoneNumber: user.phoneNumber,
        asaasCustomerId: user.asaasCustomerId,
      },
      {
        userId: user.id,
        amount: value,
        type: product ? "subscription" : "deposit",
        description,
        productId: product?.id,
        legacyReferenceId: String(inserted.id),
      },
    );

    await db.update(checkouts).set({ transactionId: charge.externalId }).where(eq(checkouts.id, inserted.id));

    return {
      qrCodeImageBase64: charge.qrCodeImageBase64,
      qrCodePayload: charge.qrCodePayload,
      expiresAt: charge.expiresAt,
    };
  }

  static async finishCheckout(reference_id: string, status: string) {
    const [refCheckout] = await db.select().from(checkouts).where(eq(checkouts.id, Number(reference_id)));
    if (!refCheckout || refCheckout.status === status) return;

    await db.update(checkouts).set({ status: status as (typeof checkouts.status.enumValues)[number] }).where(eq(checkouts.id, refCheckout.id));
    if (status !== "PAID") return;

    if (refCheckout.type === "deposit") {
      await walletService.credit({
        userId: refCheckout.userId!,
        amount: parseFloat(refCheckout.value),
        origin: "deposit",
        idempotencyKey: `checkout:${refCheckout.id}`,
        referenceType: "checkouts",
        referenceId: String(refCheckout.id),
      });
      return;
    }

    if (refCheckout.type === "subscription") {
      const [hasPlan] = await db.select().from(userPlans).where(eq(userPlans.userId, refCheckout.userId!));
      const tierUpdate = { productId: refCheckout.productId!, status: 1 as const, acquiredIn: new Date(), expiredIn: moment().add(1, "months").toDate() };

      if (hasPlan) {
        await db.update(userPlans).set(tierUpdate).where(eq(userPlans.userId, refCheckout.userId!));
      } else {
        await db.insert(userPlans).values({ userId: refCheckout.userId!, productId: refCheckout.productId!, expiredIn: moment().add(1, "months").toDate() });
      }

      await NetworkService.networkRepass(refCheckout.userId!, parseFloat(refCheckout.value), "subscription", `checkout:${refCheckout.id}`);
    }
  }

  static async newWithdrawalRequests(userId: number, value: number) {
    const [user] = await db.select({ id: botUsers.id }).from(botUsers).where(eq(botUsers.telegramUserId, String(userId)));
    await db.insert(withdrawals).values({ userId: user.id, value: String(value), referenceId: uuidv4() });
  }

  static async hasWithdrawalPendingRequests(userId: number): Promise<boolean> {
    const [user] = await db.select({ id: botUsers.id }).from(botUsers).where(eq(botUsers.telegramUserId, String(userId)));
    if (!user) return false;

    const [{ count }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(withdrawals)
      .where(and(eq(withdrawals.userId, user.id), eq(withdrawals.status, "pending")));

    return count > 0;
  }

  /** `user` aqui é a linha de `users_plans` (tem `user_id`/`product_id`), não `bot_users` — mesma convenção do código original. */
  static async renewTuition(user: LegacyPlanRow, product: { id?: number; price: string }) {
    await walletService.debit({
      userId: user.user_id,
      amount: parseFloat(product.price),
      origin: "tuition",
      idempotencyKey: `renewal:${user.user_id}:${moment().format("YYYY-MM-DD")}`,
      referenceType: "products",
      referenceId: String(product.id ?? user.product_id),
    });

    await db
      .update(userPlans)
      .set({ productId: user.product_id, status: 1, acquiredIn: new Date(), expiredIn: moment().add(1, "months").toDate() })
      .where(eq(userPlans.userId, user.user_id));
  }

  static async subscriptionWithBalance(userId: number, product: { id: number; price: string }) {
    const [user] = await db.select({ id: botUsers.id }).from(botUsers).where(eq(botUsers.telegramUserId, String(userId)));

    await walletService.debit({
      userId: user.id,
      amount: parseFloat(product.price),
      origin: "subscription",
      idempotencyKey: uuidv4(),
      referenceType: "products",
      referenceId: String(product.id),
    });

    const [hasPlan] = await db.select().from(userPlans).where(eq(userPlans.userId, user.id));
    const tierUpdate = { productId: product.id, status: 1 as const, acquiredIn: new Date(), expiredIn: moment().add(1, "months").toDate() };

    if (hasPlan) {
      await db.update(userPlans).set(tierUpdate).where(eq(userPlans.userId, user.id));
    } else {
      await db.insert(userPlans).values({ userId: user.id, productId: product.id, expiredIn: moment().add(1, "months").toDate() });
    }
  }

  static async transfersBetweenUsers(values: number, sender: number, recipient: string): Promise<string> {
    const [senderUser] = await db.select({ id: botUsers.id }).from(botUsers).where(eq(botUsers.telegramUserId, String(sender)));

    if (senderUser?.id) {
      const [recipientUser] = await db.select({ id: botUsers.id }).from(botUsers).where(eq(botUsers.email, recipient));

      await walletService.transferBetweenUsers({
        fromUserId: senderUser.id,
        toUserId: recipientUser.id,
        amount: values,
        idempotencyKey: uuidv4(),
      });
    }

    return "Transferência concluída com sucesso!";
  }
}
