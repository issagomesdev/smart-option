import { boolean, mysqlTable, timestamp, varchar } from "drizzle-orm/mysql-core";
import { createdAtColumn, deletedAtColumn, idColumn } from "./_columns";

/**
 * Clientes do bot Telegram. Nome de tabela e colunas preservados como o
 * código legado consome via SQL cru (Fases 3/4/7 migram esses consumidores).
 *
 * `id` foi ampliado de `int(11)` para `bigint` nesta fase: todas as tabelas
 * que referenciam `bot_users.id` (checkouts, withdrawals, balance, network,
 * users_plans, requests, verification_email) já usavam `bigint(20)` para a
 * FK, um descompasso de tipos que nunca foi um problema porque o schema
 * original não tinha nenhuma foreign key de fato (MyISAM). Adicionar FKs de
 * verdade exige que os tipos combinem — aumentar `bot_users.id` é a mudança
 * mais segura (não há perda de dados, apenas mais headroom).
 *
 * `adress` (sem "d" duplo) e `is_active` como inteiro são erros de nomenclatura
 * herdados, mantidos aqui de propósito — corrigir o nome quebraria o INSERT/
 * UPDATE em `register.service.ts` e `users.service.ts`, que só são reescritos
 * na Fase 4.
 */
export const botUsers = mysqlTable("bot_users", {
  id: idColumn(),
  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  password: varchar("password", { length: 255 }).notNull(),
  phoneNumber: varchar("phone_number", { length: 255 }).notNull(),
  adress: varchar("adress", { length: 255 }).notNull(),
  pixCode: varchar("pix_code", { length: 255 }).notNull(),
  isActive: boolean("is_active").notNull().default(true),
  telegramUserId: varchar("telegram_user_id", { length: 255 }).unique(),
  // CPF (Fase 3) — a Asaas recomenda para criação de customer; a coleta no
  // fluxo de cadastro do bot (com validação) é retrofit da Fase 4/7, por
  // isso fica nullable: usuários existentes ainda não têm esse dado.
  cpf: varchar("cpf", { length: 11 }),
  // Customer da Asaas (Fase 3) — criado no cadastro, usado para gerar cobranças.
  asaasCustomerId: varchar("asaas_customer_id", { length: 255 }).unique(),
  createdAt: createdAtColumn(),
  verifiedEmailAt: timestamp("verified_email_at"),
  lastActivity: timestamp("last_activity"),
  deletedAt: deletedAtColumn(),
});
