import { index, mysqlEnum, mysqlTable, varchar } from "drizzle-orm/mysql-core";
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
 *
 * Índices adicionados para o Dashboard/Auditoria Financeira: `status`+`created_at` serve tanto o
 * indicador "Solicitações aprovadas hoje" (filtra por status e data) quanto o feed unificado de
 * movimentações (filtra por status pendente); `user_id` serve o recorte por usuário do dashboard.
 */
export const checkouts = mysqlTable(
  "checkouts",
  {
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
  },
  (table) => [
    index("checkouts_status_created_at_idx").on(table.status, table.createdAt),
    index("checkouts_user_id_idx").on(table.userId),
  ],
);
