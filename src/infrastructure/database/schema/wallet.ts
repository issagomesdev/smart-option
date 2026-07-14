import { mysqlTable } from "drizzle-orm/mysql-core";
import { idColumn, moneyColumn, refIdColumn, updatedAtColumn } from "./_columns";
import { botUsers } from "./bot-users";

/**
 * Saldo materializado — um registro por cliente. É sempre um cache derivado
 * de `wallet_transactions`: a única forma permitida de alterá-lo é dentro da
 * mesma transação de banco que insere a linha de ledger correspondente
 * (nunca um UPDATE solto vindo de código de aplicação). Pode ser recalculado
 * a qualquer momento somando `wallet_transactions` — é isso que o torna
 * seguro de tratar como cache e não como fonte da verdade.
 */
export const wallets = mysqlTable("wallet", {
  id: idColumn(),
  userId: refIdColumn("user_id")
    .notNull()
    .unique()
    .references(() => botUsers.id),
  balance: moneyColumn("balance").notNull().default("0.00"),
  updatedAt: updatedAtColumn(),
});
