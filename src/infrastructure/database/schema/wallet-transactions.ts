import { index, json, mysqlEnum, mysqlTable, varchar } from "drizzle-orm/mysql-core";
import { createdAtColumn, idColumn, moneyColumn, refIdColumn } from "./_columns";
import { botUsers } from "./bot-users";
import { wallets } from "./wallet";

/**
 * Ledger novo (append-only, nunca editado/apagado). Substitui `balance` a
 * partir da Fase 4. `idempotencyKey` é a proteção contra duplicidade que a
 * tabela `balance` nunca teve — reprocessar o mesmo evento de webhook deve
 * violar essa unique constraint em vez de duplicar crédito/débito.
 */
export const walletTransactions = mysqlTable(
  "wallet_transactions",
  {
    id: idColumn(),
    walletId: refIdColumn("wallet_id")
      .notNull()
      .references(() => wallets.id),
    userId: refIdColumn("user_id")
      .notNull()
      .references(() => botUsers.id),
    direction: mysqlEnum("direction", ["credit", "debit"]).notNull(),
    origin: mysqlEnum("origin", [
      "deposit",
      "withdrawal",
      "earnings",
      "profitability",
      "subscription",
      "tuition",
      "transfer_in",
      "transfer_out",
      "admin_adjustment",
      "diamond_tax",
    ]).notNull(),
    amount: moneyColumn("amount").notNull(),
    balanceAfter: moneyColumn("balance_after").notNull(),
    referenceType: varchar("reference_type", { length: 50 }),
    referenceId: varchar("reference_id", { length: 255 }),
    idempotencyKey: varchar("idempotency_key", { length: 255 }).notNull().unique(),
    metadata: json("metadata"),
    createdAt: createdAtColumn(),
  },
  (table) => [
    index("wallet_transactions_user_id_created_at_idx").on(table.userId, table.createdAt),
    // Dashboard/Auditoria Financeira: o gráfico "Rentabilidade da rede" e o feed de movimentações
    // filtram/ordenam por origin+created_at em todos os usuários, não só por um userId — o índice
    // acima não serve essa consulta.
    index("wallet_transactions_origin_created_at_idx").on(table.origin, table.createdAt),
  ],
);
