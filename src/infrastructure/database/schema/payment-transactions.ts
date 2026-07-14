import { index, json, mysqlEnum, mysqlTable, varchar } from "drizzle-orm/mysql-core";
import { createdAtColumn, idColumn, moneyColumn, refIdColumn, updatedAtColumn } from "./_columns";
import { botUsers } from "./bot-users";
import { products } from "./products";

/**
 * Transação de pagamento junto ao gateway (depósito, assinatura ou saque).
 * Passa a existir na Fase 3, quando o módulo financeiro Asaas for implementado
 * — substitui `checkouts`/`withdrawals`, que são removidas quando o último
 * consumidor delas migrar (Fase 4).
 */
export const paymentTransactions = mysqlTable(
  "payment_transactions",
  {
    id: idColumn(),
    userId: refIdColumn("user_id")
      .notNull()
      .references(() => botUsers.id),
    provider: mysqlEnum("provider", ["asaas"]).notNull().default("asaas"),
    type: mysqlEnum("type", ["deposit", "subscription", "withdrawal"]).notNull(),
    externalId: varchar("external_id", { length: 255 }).unique(),
    status: mysqlEnum("status", ["pending", "processing", "confirmed", "failed", "cancelled", "refunded"])
      .notNull()
      .default("pending"),
    amount: moneyColumn("amount").notNull(),
    productId: refIdColumn("product_id").references(() => products.id),
    metadata: json("metadata"),
    createdAt: createdAtColumn(),
    updatedAt: updatedAtColumn(),
  },
  (table) => [index("payment_transactions_user_id_idx").on(table.userId)],
);
