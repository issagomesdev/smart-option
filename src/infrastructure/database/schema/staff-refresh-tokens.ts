import { index, mysqlTable, timestamp, varchar } from "drizzle-orm/mysql-core";
import { createdAtColumn, idColumn, refIdColumn } from "./_columns";
import { staffUsers } from "./staff-users";

/**
 * Refresh tokens do painel admin, com rotação: cada uso gera um token novo e
 * revoga o anterior (`revokedAt`). Guardamos só o hash (SHA-256) do token,
 * nunca o valor bruto — um vazamento do banco não dá um token utilizável.
 * Reuso de um token já revogado é sinal de possível roubo — ver
 * `AuthenticationService.refresh()`, que revoga toda a família nesse caso.
 */
export const staffRefreshTokens = mysqlTable(
  "staff_refresh_tokens",
  {
    id: idColumn(),
    staffUserId: refIdColumn("staff_user_id")
      .notNull()
      .references(() => staffUsers.id),
    tokenHash: varchar("token_hash", { length: 64 }).notNull().unique(),
    expiresAt: timestamp("expires_at").notNull(),
    revokedAt: timestamp("revoked_at"),
    createdAt: createdAtColumn(),
  },
  (table) => [index("staff_refresh_tokens_staff_user_id_idx").on(table.staffUserId)],
);
