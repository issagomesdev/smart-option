import { boolean, decimal, longtext, mysqlEnum, mysqlTable, varchar } from "drizzle-orm/mysql-core";
import { idColumn, moneyColumn } from "./_columns";

// `earnings_monthly` é uma taxa percentual (ex.: 8.00 = 8%), não um valor monetário —
// mantém a precisão original (5,2) em vez de reaproveitar `moneyColumn` (14,2).
const percentageColumn = (name: string) => decimal(name, { precision: 5, scale: 2 });

/**
 * Catálogo de planos/produtos. Nome e colunas preservados (consumido por múltiplos services legados).
 *
 * `isSystem` marca os 6 planos semeados (`seeds/plans.seed.ts`), protegidos contra exclusão pelo
 * mesmo motivo — e no mesmo formato — de `roles.isSystem`: `src/server/cron.ts:141-143` referencia
 * os IDs 3 (gold) e 4 (diamond) diretamente na promoção/rebaixamento automático de tier, então
 * apagá-los quebraria a rotina de rendimento. Editar continua permitido; excluir, não.
 *
 * `isActive` permite tirar um plano de circulação sem apagá-lo — necessário justamente porque
 * `users_plans` referencia produtos historicamente e a exclusão nem sempre é possível.
 */
export const products = mysqlTable("products", {
  id: idColumn(),
  name: varchar("name", { length: 255 }).notNull(),
  description: longtext("description").notNull(),
  price: moneyColumn("price").notNull().default("0.00"),
  earningsMonthly: percentageColumn("earnings_monthly").notNull(),
  purchaseType: mysqlEnum("purchase_type", ["auto", "manual"]).notNull().default("auto"),
  isSystem: boolean("is_system").notNull().default(false),
  isActive: boolean("is_active").notNull().default(true),
});
