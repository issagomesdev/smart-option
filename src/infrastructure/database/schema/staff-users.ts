import { bigint, mysqlTable, varchar } from "drizzle-orm/mysql-core";
import { createdAtColumn, deletedAtColumn, idColumn } from "./_columns";

/**
 * Usuários do painel administrativo (staff). Nome de tabela e colunas
 * preservados exatamente como o código legado (`authentication.service.ts`,
 * `auth.interceptor.ts`, `users.service.ts`) os consome via SQL cru — nenhuma
 * dessas rotas foi migrada ainda (Fase 6). `deleted_at` é aditivo: só passa a
 * ser usado quando o fluxo de exclusão for reescrito para soft delete.
 */
export const staffUsers = mysqlTable("users", {
  id: idColumn(),
  name: varchar("name", { length: 255 }).notNull(),
  surname: varchar("surname", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  password: varchar("password", { length: 255 }).notNull(),
  roleId: bigint("role_id", { mode: "number" }).notNull().default(1),
  createdAt: createdAtColumn(),
  deletedAt: deletedAtColumn(),
});
