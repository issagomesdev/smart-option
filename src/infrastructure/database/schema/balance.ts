import { mysqlEnum, mysqlTable, varchar } from "drizzle-orm/mysql-core";
import { createdAtColumn, idColumn, moneyColumn, refIdColumn } from "./_columns";
import { botUsers } from "./bot-users";

/**
 * Ledger legado (append-only) — substituído por `wallet` + `wallet_transactions`
 * na Fase 4. Nenhum código novo escreve mais aqui; o schema é mantido apenas
 * para leitura do histórico anterior à migração e como fonte do backfill
 * (`scripts/backfill-wallets.ts`). Candidata a DROP numa fase de limpeza,
 * depois que o backfill for confirmado em produção.
 */
export const legacyBalance = mysqlTable("balance", {
  id: idColumn(),
  value: moneyColumn("value").notNull(),
  userId: refIdColumn("user_id")
    .notNull()
    .references(() => botUsers.id),
  type: mysqlEnum("type", ["sum", "subtract"]).notNull(),
  origin: mysqlEnum("origin", [
    "deposit",
    "withdrawal",
    "earnings",
    "profitability",
    "subscription",
    "tuition",
    "transfer",
    "admin",
    "diamond_tax",
  ]).notNull(),
  referenceId: varchar("reference_id", { length: 255 }),
  createdAt: createdAtColumn(),
});
