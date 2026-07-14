import { int, mysqlTable, timestamp } from "drizzle-orm/mysql-core";
import { idColumn, refIdColumn } from "./_columns";
import { botUsers } from "./bot-users";
import { products } from "./products";

/** Assinatura ativa de um cliente. Nome e colunas preservados. */
export const userPlans = mysqlTable("users_plans", {
  id: idColumn(),
  userId: refIdColumn("user_id")
    .notNull()
    .references(() => botUsers.id),
  productId: refIdColumn("product_id")
    .notNull()
    .references(() => products.id),
  status: int("status").notNull().default(1),
  acquiredIn: timestamp("acquired_in").notNull().defaultNow(),
  expiredIn: timestamp("expired_in").notNull(),
});
