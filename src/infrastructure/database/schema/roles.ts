import { boolean, json, mysqlTable, varchar } from "drizzle-orm/mysql-core";
import { createdAtColumn, idColumn, updatedAtColumn } from "./_columns";
import type { Permission } from "../../../shared/permissions/permissions";

/**
 * Papéis do RBAC (Fase 5 do painel admin, parte 3). Modelo de permissão
 * deliberadamente simples — um array JSON de chaves fixas (`Permission`),
 * não um catálogo normalizado `permissions`+`role_permissions` — decidido
 * assim pela escala real deste painel (6 chaves, sem necessidade de catálogo
 * dinâmico). `isSystem` marca os dois papéis semeados nesta migration
 * (`admin`, `staff`) — protegidos contra exclusão incondicionalmente, não só
 * "se referenciado": não há motivo legítimo para apagar a base do sistema
 * de permissões.
 */
export const roles = mysqlTable("roles", {
  id: idColumn(),
  name: varchar("name", { length: 100 }).notNull().unique(),
  description: varchar("description", { length: 255 }),
  permissions: json("permissions").$type<Permission[]>().notNull().default([]),
  isSystem: boolean("is_system").notNull().default(false),
  createdAt: createdAtColumn(),
  updatedAt: updatedAtColumn(),
});
