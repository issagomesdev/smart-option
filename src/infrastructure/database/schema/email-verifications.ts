import { mysqlEnum, mysqlTable, varchar } from "drizzle-orm/mysql-core";
import { idColumn, refIdColumn } from "./_columns";
import { botUsers } from "./bot-users";

/** Tokens de verificação de e-mail no cadastro. Nome e colunas preservados. */
export const emailVerifications = mysqlTable("verification_email", {
  id: idColumn(),
  userId: refIdColumn("user_id")
    .notNull()
    .references(() => botUsers.id),
  token: varchar("token", { length: 255 }).notNull(),
  status: mysqlEnum("status", ["pending", "expired", "checked"]).notNull().default("pending"),
});
