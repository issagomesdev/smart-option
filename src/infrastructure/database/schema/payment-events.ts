import { json, mysqlEnum, mysqlTable, timestamp, varchar } from "drizzle-orm/mysql-core";
import { createdAtColumn, idColumn, refIdColumn } from "./_columns";
import { paymentTransactions } from "./payment-transactions";

/**
 * Registro bruto de cada evento de webhook recebido do gateway, usado como
 * chave de idempotência (`externalEventId`) antes de qualquer processamento
 * de negócio. Existe desde já para dar suporte ao endpoint único de webhook
 * da Fase 5, mesmo sem nenhum evento real chegando antes da Fase 3.
 */
export const paymentEvents = mysqlTable("payment_events", {
  id: idColumn(),
  paymentTransactionId: refIdColumn("payment_transaction_id").references(() => paymentTransactions.id),
  provider: mysqlEnum("provider", ["asaas"]).notNull().default("asaas"),
  eventType: varchar("event_type", { length: 100 }).notNull(),
  externalEventId: varchar("external_event_id", { length: 255 }).notNull().unique(),
  payload: json("payload").notNull(),
  processedAt: timestamp("processed_at"),
  createdAt: createdAtColumn(),
});
