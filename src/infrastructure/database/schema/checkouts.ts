import { mysqlEnum, mysqlTable, varchar } from "drizzle-orm/mysql-core";
import { createdAtColumn, idColumn, moneyColumn, refIdColumn } from "./_columns";
import { botUsers } from "./bot-users";
import { products } from "./products";

/**
 * Registro da intenção de cobrança (depósito/assinatura) — quem cria é
 * `TransactionsService.checkout()`, hoje via Asaas (o enum de status manteve
 * o vocabulário herdado do PagBank de propósito, é só rótulo). Continua em
 * uso após a Fase 4: `payment_transactions` registra a execução no gateway,
 * `checkouts` é a entidade de negócio "cobrança pedida por este usuário" que
 * o bot/painel consultam para status — os dois têm papéis diferentes.
 */
export const checkouts = mysqlTable("checkouts", {
  id: idColumn(),
  referenceId: varchar("reference_id", { length: 255 }).notNull(),
  type: mysqlEnum("type", ["deposit", "subscription"]).notNull(),
  value: moneyColumn("value").notNull(),
  status: mysqlEnum("status", ["PENDING", "AUTHORIZED", "PAID", "IN_ANALYSIS", "DECLINED", "CANCELED"])
    .notNull()
    .default("PENDING"),
  transactionId: varchar("transaction_id", { length: 255 }),
  productId: refIdColumn("product_id").references(() => products.id),
  userId: refIdColumn("user_id").references(() => botUsers.id),
  createdAt: createdAtColumn(),
});
