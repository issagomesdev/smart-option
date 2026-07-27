import { index, longtext, mysqlEnum, mysqlTable, varchar } from "drizzle-orm/mysql-core";
import { createdAtColumn, idColumn, moneyColumn, refIdColumn } from "./_columns";
import { botUsers } from "./bot-users";

/**
 * Fila de solicitações de saque, incluindo a aprovação humana pelo painel
 * admin antes de qualquer chamada à Asaas — um estado que `payment_transactions`
 * não representa (ela só passa a existir quando o saque já foi aprovado e
 * enviado ao gateway). Por isso `withdrawals` continua sendo a entidade de
 * negócio "saque pedido por este usuário", mesmo após a Fase 4.
 *
 * Índices adicionados para o Dashboard/Auditoria Financeira: `status`+`created_at` serve o card
 * "Saques pendentes" e o feed unificado de movimentações; `user_id` serve o recorte por usuário.
 */
export const withdrawals = mysqlTable(
  "withdrawals",
  {
    id: idColumn(),
    userId: refIdColumn("user_id")
      .notNull()
      .references(() => botUsers.id),
    value: moneyColumn("value").notNull(),
    status: mysqlEnum("status", ["pending", "authorized", "refused", "failed", "success"])
      .notNull()
      .default("pending"),
    replyObservation: longtext("reply_observation"),
    errorsCause: varchar("errors_cause", { length: 255 }),
    referenceId: varchar("reference_id", { length: 255 }).notNull(),
    transactionId: varchar("transaction_id", { length: 255 }),
    createdAt: createdAtColumn(),
  },
  (table) => [
    index("withdrawals_status_created_at_idx").on(table.status, table.createdAt),
    index("withdrawals_user_id_idx").on(table.userId),
  ],
);
