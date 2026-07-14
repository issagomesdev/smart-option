import { decimal, mysqlEnum, mysqlTable } from "drizzle-orm/mysql-core";
import { idColumn, refIdColumn } from "./_columns";
import { products } from "./products";

const percentageColumn = (name: string) => decimal(name, { precision: 5, scale: 2 });

/** Matriz de comissão (nível x tipo) por produto. Nome e colunas preservados. */
export const productEarnings = mysqlTable("product_earnings", {
  id: idColumn(),
  productId: refIdColumn("product_id")
    .notNull()
    .references(() => products.id),
  level: mysqlEnum("level", ["1", "2", "3"]).notNull(),
  type: mysqlEnum("type", ["subscription", "earnings"]).notNull(),
  percentage: percentageColumn("percentage").notNull(),
});
