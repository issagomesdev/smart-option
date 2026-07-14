import { int, mysqlEnum, mysqlTable } from "drizzle-orm/mysql-core";
import { idColumn, refIdColumn } from "./_columns";
import { botUsers } from "./bot-users";

/** Árvore de afiliados (até 3 níveis). Nome e colunas preservados. */
export const affiliateNetwork = mysqlTable("network", {
  id: idColumn(),
  affiliateUserId: refIdColumn("affiliate_user_id")
    .notNull()
    .references(() => botUsers.id),
  guestUserId: refIdColumn("guest_user_id")
    .notNull()
    .references(() => botUsers.id),
  level: mysqlEnum("level", ["1", "2", "3"]).notNull(),
  earnings: int("earnings").notNull().default(0),
});
