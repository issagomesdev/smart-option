import { and, eq, isNull, like, or, sql } from "drizzle-orm";
import { SHA1 } from "crypto-js";
import { bot } from "../bot/index";
import { TransactionsService } from "./bot/transactions.service";
import moment from "moment";
import { v4 as uuidv4 } from "uuid";
import { walletService } from "../wallet/wallet.service";
import { db } from "../infrastructure/database/client";
import {
  affiliateNetwork,
  auditLogs,
  botUsers,
  checkouts,
  emailVerifications,
  products,
  staffUsers,
  supportRequests,
  userPlans,
  withdrawals,
} from "../infrastructure/database/schema";
import { ValidationError, NotFoundError } from "../shared/errors";
import { hashPassword, verifyPassword } from "../shared/security/password";

interface BotUserFilters {
  user_id?: string;
  name?: string;
  email?: string;
  product_id?: string;
  status?: string;
  is_active?: string;
  created_at?: string;
  telegram?: string;
  balance?: string;
}

export class UsersService {
  static async users() {
    return db.select().from(staffUsers);
  }

  static async updateUser(user: { id: number; name: string; surname: string; email: string }) {
    await db.update(staffUsers).set({ name: user.name, surname: user.surname, email: user.email }).where(eq(staffUsers.id, user.id));
    return { status: true };
  }

  static async updatePass(data: { userId: number; currentPassword: string; newPassword: string }) {
    const [user] = await db.select({ password: staffUsers.password }).from(staffUsers).where(eq(staffUsers.id, data.userId));
    if (!user) throw new NotFoundError("Usuário inexistente");

    const matches = await verifyPassword(user.password, data.currentPassword);
    if (!matches) throw new ValidationError("A senha atual inserida não corresponde à senha da conta em questão.");

    await db.update(staffUsers).set({ password: await hashPassword(data.newPassword) }).where(eq(staffUsers.id, data.userId));
    return { status: true };
  }

  static async botUsers(search: string, filters: BotUserFilters | null = null) {
    const conditions = [];

    if (search !== "all") {
      const numericId = Number(search);
      conditions.push(
        Number.isInteger(numericId) ? or(eq(botUsers.id, numericId), like(botUsers.name, `%${search}%`)) : like(botUsers.name, `%${search}%`),
      );
    } else if (filters) {
      if (filters.user_id) conditions.push(like(sql`CAST(${botUsers.id} AS CHAR)`, `%${filters.user_id}%`));
      if (filters.name) conditions.push(like(botUsers.name, `%${filters.name}%`));
      if (filters.email) conditions.push(like(botUsers.email, `%${filters.email}%`));
      if (filters.product_id && filters.product_id !== "all") conditions.push(eq(products.id, Number(filters.product_id)));
      if (filters.status && filters.status !== "all") {
        conditions.push(
          filters.status === "0"
            ? or(eq(userPlans.status, 0), isNull(userPlans.status))
            : eq(userPlans.status, Number(filters.status)),
        );
      }
      if (filters.is_active && filters.is_active !== "all") conditions.push(eq(botUsers.isActive, filters.is_active === "1"));
    }

    const rows = await db
      .select({
        id: botUsers.id,
        name: botUsers.name,
        email: botUsers.email,
        plan: sql<string>`COALESCE(${products.name}, 'without')`,
        telegram: botUsers.telegramUserId,
        created_at: sql<string>`DATE_FORMAT(${botUsers.createdAt}, '%d/%m/%Y')`,
        is_active: botUsers.isActive,
        status: userPlans.status,
      })
      .from(botUsers)
      .leftJoin(userPlans, eq(botUsers.id, userPlans.userId))
      .leftJoin(products, eq(products.id, userPlans.productId))
      .where(conditions.length ? and(...conditions) : undefined);

    const users: any[] = rows;

    for (let i = users.length - 1; i >= 0; i--) {
      const user = users[i];

      if (filters && filters.telegram) {
        if (user.telegram) {
          const telegramUsername = (await bot.getChat(user.telegram)).username;
          user.telegram = telegramUsername;
          if (!telegramUsername.includes(filters.telegram)) {
            users.splice(i, 1);
            continue;
          }
        } else {
          users.splice(i, 1);
          continue;
        }
      } else {
        user.telegram = user.telegram ? (await bot.getChat(user.telegram)).username : "off";
      }

      if (filters && filters.balance) {
        const balance = `${await TransactionsService.balance(null, true, user)}`;
        if (balance.includes(filters.balance)) {
          user.balance = balance;
        } else {
          users.splice(i, 1);
        }
      } else {
        user.balance = await TransactionsService.balance(null, true, user);
      }
    }

    return users;
  }

  static async botUser(id: string) {
    const [user] = await db
      .select({
        id: botUsers.id,
        productId: userPlans.productId,
        name: botUsers.name,
        email: botUsers.email,
        phoneNumber: botUsers.phoneNumber,
        adress: botUsers.adress,
        pixCode: botUsers.pixCode,
        isActive: botUsers.isActive,
        plan: sql<string>`COALESCE(${products.name}, 'without')`,
        telegram: botUsers.telegramUserId,
        created_at: sql<string>`DATE_FORMAT(${botUsers.createdAt}, '%d/%m/%Y')`,
        status: userPlans.status,
      })
      .from(botUsers)
      .leftJoin(userPlans, eq(botUsers.id, userPlans.userId))
      .leftJoin(products, eq(products.id, userPlans.productId))
      .where(eq(botUsers.id, Number(id)));

    if (!user) throw new NotFoundError("Usuário inexistente");

    const result: any = user;
    result.telegram = result.telegram ? (await bot.getChat(result.telegram)).username : "off";

    return result;
  }

  static async updateBotUser(body: {
    id: number;
    name: string;
    email: string;
    password?: string;
    phone_number: string;
    adress: string;
    pix_code: string;
    product_id?: number;
  }) {
    const [user] = await db.select().from(botUsers).where(eq(botUsers.id, body.id));
    if (!user) throw new NotFoundError("Usuário Inexistente");

    // `bot_users.password` continua em SHA1 de propósito: o login do bot
    // (`services/bot/auth.service.ts`) ainda compara via SHA1 e não foi
    // migrado nesta fase — trocar o hash aqui sem migrar o login quebraria
    // o acesso de qualquer usuário que tivesse a senha redefinida pelo painel.
    await db
      .update(botUsers)
      .set({
        name: body.name,
        email: body.email,
        ...(body.password ? { password: SHA1(body.password).toString() } : {}),
        phoneNumber: body.phone_number,
        adress: body.adress,
        pixCode: body.pix_code,
      })
      .where(eq(botUsers.id, body.id));

    const [hasPlan] = await db.select().from(userPlans).where(eq(userPlans.userId, body.id));

    if (body.product_id) {
      if (hasPlan) {
        await db
          .update(userPlans)
          .set({ productId: body.product_id, status: 1, acquiredIn: new Date(), expiredIn: moment().add(1, "months").toDate() })
          .where(eq(userPlans.userId, body.id));
      } else {
        await db.insert(userPlans).values({ userId: body.id, productId: body.product_id, expiredIn: moment().add(1, "months").toDate() });
      }
    } else if (hasPlan) {
      await db.delete(userPlans).where(eq(userPlans.userId, body.id));
    }

    return { status: true, message: "Usuário atualizado com sucesso" };
  }

  static async deleteBotUser(id: number) {
    await db.delete(botUsers).where(eq(botUsers.id, id));
    await db.delete(checkouts).where(eq(checkouts.userId, id));
    await db.delete(supportRequests).where(eq(supportRequests.userId, id));
    await db.delete(userPlans).where(eq(userPlans.userId, id));
    await db.delete(emailVerifications).where(eq(emailVerifications.userId, id));
    await db.delete(withdrawals).where(eq(withdrawals.userId, id));
    await db.delete(affiliateNetwork).where(or(eq(affiliateNetwork.affiliateUserId, id), eq(affiliateNetwork.guestUserId, id)));

    return { status: true, message: "Usuário excluído com sucesso" };
  }

  static async isActiveBotUser(userId: number, status: number) {
    const [user] = await db.select({ id: botUsers.id }).from(botUsers).where(eq(botUsers.id, userId));
    if (!user) throw new NotFoundError("Usuário Inexistente");

    await db.update(botUsers).set({ isActive: Boolean(status), telegramUserId: null }).where(eq(botUsers.id, userId));

    return { status: true, message: "Usuário atualizado com sucesso" };
  }

  static async transfValuesAdmin(data: { user_id: number; value: string; type: "sum" | "subtract" }, actor: { id: number; email: string } | null = null) {
    if (data.type !== "sum" && data.type !== "subtract") {
      throw new ValidationError("Tipo de ajuste inválido — use 'sum' ou 'subtract'.");
    }

    const idempotencyKey = uuidv4();
    const amount = parseFloat(data.value);

    const result =
      data.type === "sum"
        ? await walletService.credit({ userId: data.user_id, amount, origin: "admin_adjustment", idempotencyKey })
        : await walletService.debit({ userId: data.user_id, amount, origin: "admin_adjustment", idempotencyKey });

    await db.insert(auditLogs).values({
      actorType: "staff_user",
      actorId: actor?.id ?? null,
      action: data.type === "sum" ? "wallet.admin_credit" : "wallet.admin_debit",
      entityType: "bot_users",
      entityId: String(data.user_id),
      after: { amount, balanceAfter: result.balanceAfter, actorEmail: actor?.email ?? null },
    });

    return { status: true, message: "Usuário atualizado com sucesso" };
  }
}
