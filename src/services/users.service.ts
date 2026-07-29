import { and, eq, isNull, like, or, sql } from "drizzle-orm";
import { SHA1 } from "crypto-js";
import { bot } from "../bot/index";
import { TransactionsService } from "./bot/transactions.service";
import moment from "moment";
import { v4 as uuidv4 } from "uuid";
import { walletService } from "../wallet/wallet.service";
import { db } from "../infrastructure/database/client";
import { offsetFor, paginate, type PaginatedResult, type PaginationParams } from "../shared/http/pagination";
import { resolveSort } from "../shared/http/sorting";
import {
  affiliateNetwork,
  botUsers,
  checkouts,
  emailVerifications,
  legacyBalance,
  paymentTransactions,
  products,
  staffUsers,
  supportRequests,
  userPlans,
  walletTransactions,
  wallets,
  withdrawals,
} from "../infrastructure/database/schema";
import { ValidationError, NotFoundError } from "../shared/errors";
import { recordAudit, type AuditActor } from "../shared/audit/audit-log";
import { hashPassword, verifyPassword } from "../shared/security/password";
import { logger } from "../shared/logger";

interface BotUserFilters extends Partial<PaginationParams> {
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

/**
 * `telegram`/`balance` só existem depois do enriquecimento em JS (chamada ao
 * Telegram, cálculo de saldo via `TransactionsService.balance`) — não dá pra
 * ordenar via SQL. Usados só no caminho lento (`needsPostFilter`), depois que
 * cada linha já foi enriquecida; `created_at` usa `created_at_raw` (o `Date`
 * cru, não a string `DD/MM/YYYY` formatada para exibição) para ordenar
 * cronologicamente de verdade.
 */
const BOT_USER_SORT_ACCESSORS: Record<string, (user: any) => number | string> = {
  id: (user) => user.id,
  name: (user) => String(user.name ?? "").toLowerCase(),
  email: (user) => String(user.email ?? "").toLowerCase(),
  plan: (user) => String(user.plan ?? "").toLowerCase(),
  telegram: (user) => String(user.telegram ?? "").toLowerCase(),
  created_at: (user) => (user.created_at_raw instanceof Date ? user.created_at_raw.getTime() : 0),
  is_active: (user) => (user.is_active ? 1 : 0),
  status: (user) => user.status ?? -1,
  balance: (user) => Number(user.balance) || 0,
};

function sortBotUsersInMemory<T>(users: T[], sortBy: string | undefined, sortDirection: "asc" | "desc" | undefined): T[] {
  const accessor = (sortBy && BOT_USER_SORT_ACCESSORS[sortBy]) || BOT_USER_SORT_ACCESSORS.id;
  const direction = sortDirection === "desc" ? -1 : 1;

  return [...users].sort((a, b) => {
    const left = accessor(a);
    const right = accessor(b);
    if (left < right) return -1 * direction;
    if (left > right) return 1 * direction;
    return 0;
  });
}

export class UsersService {
  /**
   * `bot.getChat` falha com `ETELEGRAM: 400 chat not found` quando o
   * `telegram_user_id` gravado não corresponde mais a um chat válido (conta
   * apagada, bot bloqueado, dado de teste sujo) — sem este try/catch, uma
   * única linha nessas condições derrubava a listagem inteira com 500,
   * mesmo filtrando por outro usuário. `"indisponível"` distingue esse caso
   * de "off" (nunca vinculou telegram).
   */
  private static async resolveTelegramUsername(telegramUserId: string | null): Promise<string> {
    if (!telegramUserId) return "off";

    try {
      const chat = await bot.getChat(telegramUserId);
      return chat.username ?? "off";
    } catch (error) {
      logger.warn({ err: error, telegramUserId }, "Falha ao buscar chat do Telegram (dado possivelmente inválido)");
      return "indisponível";
    }
  }

  /**
   * `id` vem sempre de `req.user!.id` (a sessão autenticada), nunca do corpo
   * da requisição — antes desta correção, `update-user`/`update-pass`
   * confiavam num `id`/`userId` mandado pelo cliente sem checar posse:
   * qualquer staff autenticado conseguia editar o perfil ou trocar a senha
   * de qualquer outro staff, não só a própria conta.
   */
  static async updateUser(id: number, patch: { name: string; surname: string; email: string }) {
    await db.update(staffUsers).set({ name: patch.name, surname: patch.surname, email: patch.email }).where(eq(staffUsers.id, id));
    return { status: true };
  }

  static async updatePass(id: number, data: { currentPassword: string; newPassword: string }) {
    const [user] = await db.select({ password: staffUsers.password }).from(staffUsers).where(eq(staffUsers.id, id));
    if (!user) throw new NotFoundError("Usuário inexistente");

    const matches = await verifyPassword(user.password, data.currentPassword);
    if (!matches) throw new ValidationError("A senha atual inserida não corresponde à senha da conta em questão.");

    await db.update(staffUsers).set({ password: await hashPassword(data.newPassword) }).where(eq(staffUsers.id, id));
    return { status: true };
  }

  // `search: "all"` + `filters` sempre presentes é o caminho de listagem paginada
  // (`POST /users-bot`); qualquer outra chamada (busca por termo/id, `GET
  // /users-bot/:search`) devolve o array simples de sempre, sem paginação.
  static async botUsers(search: "all", filters: BotUserFilters): Promise<PaginatedResult<any>>;
  static async botUsers(search: string, filters?: BotUserFilters | null): Promise<any[]>;
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

    const where = conditions.length ? and(...conditions) : undefined;
    // `filters !== null` (não só `search === "all"`) distingue a listagem
    // paginada (`POST /users-bot`, sempre manda um body) da busca por termo
    // (`GET /users-bot/:search`, nunca manda filtros) — mesmo no caso raro de
    // alguém buscar literalmente pelo termo "all".
    const isListQuery = search === "all" && filters !== null;
    // telegram/balance dependem de chamadas externas por linha (bot.getChat,
    // TransactionsService.balance) — filtrar por eles só é possível depois de
    // já ter os dados na mão, então paginar no banco antes cortaria linhas
    // válidas da página. Nesses dois casos caímos para o comportamento
    // antigo: busca tudo, filtra em memória, só então pagina o array.
    // `sortBy` em `telegram`/`balance` também força o caminho lento — esses
    // dois campos só existem depois do enriquecimento em JS (mesmo motivo já
    // documentado acima para `needsPostFilter` via filtro), então não dá pra
    // resolver a ordenação num `.orderBy()` de SQL.
    const needsPostFilter = Boolean(
      filters?.telegram || filters?.balance || filters?.sortBy === "telegram" || filters?.sortBy === "balance",
    );
    const page = filters?.page ?? 1;
    const limit = filters?.limit ?? 20;

    if (isListQuery && !needsPostFilter) {
      const listColumns = {
        id: botUsers.id,
        name: botUsers.name,
        email: botUsers.email,
        plan: sql<string>`COALESCE(${products.name}, 'without')`,
        created_at: botUsers.createdAt,
        is_active: botUsers.isActive,
        status: userPlans.status,
      };
      const orderBy = resolveSort(listColumns, filters, botUsers.id);

      const [rows, [{ total }]] = await Promise.all([
        db
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
          .where(where)
          .orderBy(orderBy)
          .limit(limit)
          .offset(offsetFor({ page, limit })),
        db
          .select({ total: sql<number>`count(*)` })
          .from(botUsers)
          .leftJoin(userPlans, eq(botUsers.id, userPlans.userId))
          .leftJoin(products, eq(products.id, userPlans.productId))
          .where(where),
      ]);

      const users: any[] = rows;
      for (const user of users) {
        user.telegram = await UsersService.resolveTelegramUsername(user.telegram);
        user.balance = await TransactionsService.balance(null, true, user);
      }

      return paginate(users, { page, limit }, Number(total));
    }

    const rows = await db
      .select({
        id: botUsers.id,
        name: botUsers.name,
        email: botUsers.email,
        plan: sql<string>`COALESCE(${products.name}, 'without')`,
        telegram: botUsers.telegramUserId,
        created_at: sql<string>`DATE_FORMAT(${botUsers.createdAt}, '%d/%m/%Y')`,
        // `Date` cru, só para ordenar em memória (`sortBotUsersInMemory`) —
        // removido de cada linha antes de devolver a resposta.
        created_at_raw: botUsers.createdAt,
        is_active: botUsers.isActive,
        status: userPlans.status,
      })
      .from(botUsers)
      .leftJoin(userPlans, eq(botUsers.id, userPlans.userId))
      .leftJoin(products, eq(products.id, userPlans.productId))
      .where(where);

    const users: any[] = rows;

    for (let i = users.length - 1; i >= 0; i--) {
      const user = users[i];

      if (filters && filters.telegram) {
        if (user.telegram) {
          const telegramUsername = await UsersService.resolveTelegramUsername(user.telegram);
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
        user.telegram = await UsersService.resolveTelegramUsername(user.telegram);
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

    const sorted = sortBotUsersInMemory(users, filters?.sortBy, filters?.sortDirection);
    for (const user of sorted) delete (user as { created_at_raw?: Date }).created_at_raw;

    if (!isListQuery) return sorted;

    const start = offsetFor({ page, limit });
    return paginate(sorted.slice(start, start + limit), { page, limit }, sorted.length);
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
    result.telegram = await UsersService.resolveTelegramUsername(result.telegram);

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
  }, actor: AuditActor | null = null) {
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

    await recordAudit({
      action: "bot_user.updated",
      entityType: "bot_users",
      entityId: body.id,
      actor,
      before: { name: user.name, email: user.email, phoneNumber: user.phoneNumber, adress: user.adress, pixCode: user.pixCode },
      after: {
        name: body.name,
        email: body.email,
        phoneNumber: body.phone_number,
        adress: body.adress,
        pixCode: body.pix_code,
        productId: body.product_id ?? null,
        passwordChanged: Boolean(body.password),
      },
    });

    return { status: true, message: "Usuário atualizado com sucesso" };
  }

  /**
   * Ordem importa: `bot_users` é referenciada por FK de todas as tabelas
   * abaixo, então precisa ser a última a ser apagada (senão a constraint
   * rejeita o delete assim que existir qualquer linha filha — o que é o caso
   * de praticamente todo usuário real, já que o cadastro sempre grava em
   * `email_verifications`). `wallet_transactions` também referencia
   * `wallet.id`, então sai antes de `wallet`. Tudo numa única transação para
   * não deixar dados órfãos se alguma etapa falhar no meio.
   */
  static async deleteBotUser(id: number, actor: AuditActor | null = null) {
    const [existing] = await db.select().from(botUsers).where(eq(botUsers.id, id));

    await db.transaction(async (tx) => {
      await tx.delete(checkouts).where(eq(checkouts.userId, id));
      await tx.delete(supportRequests).where(eq(supportRequests.userId, id));
      await tx.delete(userPlans).where(eq(userPlans.userId, id));
      await tx.delete(emailVerifications).where(eq(emailVerifications.userId, id));
      await tx.delete(withdrawals).where(eq(withdrawals.userId, id));
      await tx
        .delete(affiliateNetwork)
        .where(or(eq(affiliateNetwork.affiliateUserId, id), eq(affiliateNetwork.guestUserId, id)));
      await tx.delete(legacyBalance).where(eq(legacyBalance.userId, id));
      await tx.delete(paymentTransactions).where(eq(paymentTransactions.userId, id));
      await tx.delete(walletTransactions).where(eq(walletTransactions.userId, id));
      await tx.delete(wallets).where(eq(wallets.userId, id));
      await tx.delete(botUsers).where(eq(botUsers.id, id));
    });

    // O `before` é a última fotografia do usuário: depois deste delete em cascata não sobra nada
    // no banco para reconstruir quem foi removido.
    await recordAudit({
      action: "bot_user.deleted",
      entityType: "bot_users",
      entityId: id,
      actor,
      before: existing ? { name: existing.name, email: existing.email, telegramUserId: existing.telegramUserId } : null,
    });

    return { status: true, message: "Usuário excluído com sucesso" };
  }

  static async isActiveBotUser(userId: number, status: number, actor: AuditActor | null = null) {
    const [user] = await db.select({ id: botUsers.id, name: botUsers.name, email: botUsers.email }).from(botUsers).where(eq(botUsers.id, userId));
    if (!user) throw new NotFoundError("Usuário Inexistente");

    await db.update(botUsers).set({ isActive: Boolean(status), telegramUserId: null }).where(eq(botUsers.id, userId));

    await recordAudit({
      action: status ? "bot_user.unblocked" : "bot_user.blocked",
      entityType: "bot_users",
      entityId: userId,
      actor,
      before: { isActive: !status },
      after: { isActive: Boolean(status), name: user.name, email: user.email },
    });

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

    await recordAudit({
      action: data.type === "sum" ? "wallet.admin_credit" : "wallet.admin_debit",
      entityType: "bot_users",
      entityId: data.user_id,
      actor,
      after: { amount, balanceAfter: result.balanceAfter },
    });

    return { status: true, message: "Usuário atualizado com sucesso" };
  }
}
