import { decimal, longtext, mysqlEnum, mysqlTable, varchar } from "drizzle-orm/mysql-core";
import { idColumn, moneyColumn } from "./_columns";

// `earnings_monthly` é uma taxa percentual (ex.: 8.00 = 8%), não um valor monetário —
// mantém a precisão original (5,2) em vez de reaproveitar `moneyColumn` (14,2).
const percentageColumn = (name: string) => decimal(name, { precision: 5, scale: 2 });

/** Catálogo de planos/produtos. Nome e colunas preservados (consumido por múltiplos services legados). */
export const products = mysqlTable("products", {
  id: idColumn(),
  name: varchar("name", { length: 255 }).notNull(),
  description: longtext("description").notNull(),
  price: moneyColumn("price").notNull().default("0.00"),
  earningsMonthly: percentageColumn("earnings_monthly").notNull(),
  purchaseType: mysqlEnum("purchase_type", ["auto", "manual"]).notNull().default("auto"),
});
