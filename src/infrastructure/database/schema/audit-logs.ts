import { bigint, index, json, mysqlEnum, mysqlTable, varchar } from "drizzle-orm/mysql-core";
import { createdAtColumn, idColumn } from "./_columns";

/**
 * Trilha de auditoria genérica para ações sensíveis (aprovação de saque,
 * ajuste manual de saldo, banimento de usuário, etc.). Sem FK para
 * `actorId`/`entityId` de propósito: o ator pode ser um usuário do painel,
 * um cliente do bot ou o próprio sistema (cron), e a entidade auditada varia
 * por tabela — `actorType`/`entityType` documentam o que `actorId`/`entityId`
 * significam em cada linha.
 */
export const auditLogs = mysqlTable(
  "audit_logs",
  {
    id: idColumn(),
    actorType: mysqlEnum("actor_type", ["staff_user", "bot_user", "system"]).notNull(),
    actorId: bigint("actor_id", { mode: "number" }),
    action: varchar("action", { length: 100 }).notNull(),
    entityType: varchar("entity_type", { length: 100 }).notNull(),
    entityId: varchar("entity_id", { length: 255 }),
    before: json("before"),
    after: json("after"),
    ipAddress: varchar("ip_address", { length: 45 }),
    createdAt: createdAtColumn(),
  },
  (table) => [index("audit_logs_entity_idx").on(table.entityType, table.entityId)],
);
