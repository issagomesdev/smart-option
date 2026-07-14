import { index, json, longtext, mysqlEnum, mysqlTable, timestamp, varchar } from "drizzle-orm/mysql-core";
import { idColumn } from "./_columns";

/**
 * Captura bruta de toda requisição recebida em `POST /api/webhooks/asaas`
 * (Fase 5), antes de qualquer validação de negócio — existe para proteção
 * contra replay, auditoria e depuração, independente de o evento ter sido
 * aceito ou rejeitado.
 */
export const webhookLogs = mysqlTable(
  "webhook_logs",
  {
    id: idColumn(),
    provider: mysqlEnum("provider", ["asaas"]).notNull().default("asaas"),
    eventType: varchar("event_type", { length: 100 }),
    externalId: varchar("external_id", { length: 255 }),
    headers: json("headers"),
    payload: json("payload").notNull(),
    status: mysqlEnum("status", ["received", "processing", "processed", "failed", "duplicate"])
      .notNull()
      .default("received"),
    error: longtext("error"),
    receivedAt: timestamp("received_at").notNull().defaultNow(),
    processedAt: timestamp("processed_at"),
  },
  (table) => [index("webhook_logs_external_id_idx").on(table.externalId)],
);
