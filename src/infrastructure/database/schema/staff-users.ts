import { mysqlTable, varchar } from "drizzle-orm/mysql-core";
import { createdAtColumn, deletedAtColumn, idColumn, refIdColumn } from "./_columns";
import { roles } from "./roles";

/**
 * Usuários do painel administrativo (staff). Nome de tabela e colunas
 * preservados exatamente como o código legado (`authentication.service.ts`,
 * `auth.interceptor.ts`, `users.service.ts`) os consome via SQL cru — nenhuma
 * dessas rotas foi migrada ainda (Fase 6). `deleted_at` passa a ser usado a
 * partir da Fase 5 (RBAC): desativação de staff é soft-delete, e
 * `authenticateToken`/`AuthenticationService.login` filtram `deletedAt IS
 * NULL`, então uma desativação tem efeito imediato (sem esperar o token
 * expirar), igual a uma troca de papel.
 *
 * `roleId` era um `bigint` **assinado** sem FK (default `1`, nunca
 * verificado contra nada) até a Fase 5 parte 3 — virou `refIdColumn`
 * (unsigned, igual a `idColumn()`) com FK de verdade para `roles.id`. O
 * default mudou de `1` (`admin`, o papel do staff já semeado) para `2`
 * (`staff`, o papel de privilégio baixo) — só afeta inserções futuras; a
 * migration que introduziu a FK também semeia os dois papéis e não altera a
 * linha do staff já existente.
 */
export const staffUsers = mysqlTable("users", {
  id: idColumn(),
  name: varchar("name", { length: 255 }).notNull(),
  surname: varchar("surname", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  password: varchar("password", { length: 255 }).notNull(),
  roleId: refIdColumn("role_id").notNull().default(2).references(() => roles.id),
  createdAt: createdAtColumn(),
  deletedAt: deletedAtColumn(),
});
