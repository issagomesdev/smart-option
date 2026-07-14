import { bigint, int, longtext, mysqlEnum, mysqlTable } from "drizzle-orm/mysql-core";
import { createdAtColumn, idColumn, refIdColumn } from "./_columns";
import { botUsers } from "./bot-users";

/** Tickets de suporte/atendimento abertos pelo bot. Nome e colunas preservados. */
export const supportRequests = mysqlTable("requests", {
  id: idColumn(),
  type: mysqlEnum("type", ["support", "service"]).notNull(),
  subject: longtext("subject").notNull(),
  isRead: int("is_read").notNull().default(0),
  userId: refIdColumn("user_id")
    .notNull()
    .references(() => botUsers.id),
  // Snapshot do ID do Telegram no momento do ticket — não é uma FK, é
  // informativo (o valor original já era um bigint solto, sem referenciar
  // `bot_users.telegram_user_id`, que é varchar).
  telegramUserId: bigint("telegram_user_id", { mode: "number" }).notNull(),
  createdAt: createdAtColumn(),
});
