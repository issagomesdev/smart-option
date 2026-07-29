import { and, desc, eq, gte, like, lte, or, sql, type SQL } from "drizzle-orm";
import { db } from "../infrastructure/database/client";
import { auditLogs, staffUsers } from "../infrastructure/database/schema";
import { offsetFor, paginate, type PaginatedResult } from "../shared/http/pagination";
import { resolvePeriod } from "../shared/http/period";
import type { AuditActionFilters } from "../interfaces/http/dtos/audit-actions.dto";

export interface AuditActionRow {
  id: number;
  action: string;
  entityType: string;
  entityId: string | null;
  /** `null` quando o ator já foi removido — o e-mail em `after.actorEmail` preserva quem agiu. */
  actorId: number | null;
  actorName: string | null;
  actorEmail: string | null;
  before: unknown;
  after: unknown;
  createdAt: Date;
}

/**
 * Consulta da trilha de auditoria de ações administrativas (`audit_logs`).
 *
 * Complementa a Auditoria Financeira: lá o assunto é o dinheiro que se moveu, aqui é **quem** mexeu
 * em quê. As duas leem tabelas diferentes de propósito — `wallet_transactions` é o razão contábil,
 * `audit_logs` é o registro de intervenção administrativa.
 *
 * Nunca cacheada, pela mesma razão da auditoria financeira: uma trilha que serve para investigar
 * precisa refletir o estado real a cada consulta.
 */
export class AuditActionsService {
  static async list(filters: AuditActionFilters): Promise<PaginatedResult<AuditActionRow>> {
    const conditions: SQL[] = [];

    if (filters.period) {
      const range = resolvePeriod({ period: filters.period, start: filters.start, end: filters.end });
      conditions.push(gte(auditLogs.createdAt, range.currentStart), lte(auditLogs.createdAt, range.currentEnd));
    }
    if (filters.action) conditions.push(eq(auditLogs.action, filters.action));
    if (filters.entityType) conditions.push(eq(auditLogs.entityType, filters.entityType));
    if (filters.actorId) conditions.push(eq(auditLogs.actorId, filters.actorId));

    const search = filters.search?.trim();
    if (search) {
      conditions.push(
        or(
          like(auditLogs.entityId, `%${search}%`),
          like(staffUsers.name, `%${search}%`),
          like(staffUsers.email, `%${search}%`),
          // O e-mail do ator também vive dentro do JSON `after`, que é o que sobra quando a conta
          // do administrador é removida — sem isso, uma busca por ele perderia justamente as linhas
          // mais antigas, que são as que mais interessam numa investigação.
          like(sql`CAST(${auditLogs.after} AS CHAR)`, `%${search}%`),
        )!,
      );
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    // `leftJoin`: `actorId` não tem FK (o ator pode ser staff, usuário do bot ou o sistema), e uma
    // conta removida não pode fazer a linha de auditoria desaparecer da consulta.
    const [rows, [{ total }]] = await Promise.all([
      db
        .select({
          id: auditLogs.id,
          action: auditLogs.action,
          entityType: auditLogs.entityType,
          entityId: auditLogs.entityId,
          actorId: auditLogs.actorId,
          actorName: sql<string | null>`CONCAT_WS(' ', ${staffUsers.name}, ${staffUsers.surname})`,
          actorEmail: staffUsers.email,
          before: auditLogs.before,
          after: auditLogs.after,
          createdAt: auditLogs.createdAt,
        })
        .from(auditLogs)
        .leftJoin(staffUsers, eq(staffUsers.id, auditLogs.actorId))
        .where(where)
        .orderBy(desc(auditLogs.createdAt), desc(auditLogs.id))
        .limit(filters.limit)
        .offset(offsetFor(filters)),
      db
        .select({ total: sql<number>`count(*)` })
        .from(auditLogs)
        .leftJoin(staffUsers, eq(staffUsers.id, auditLogs.actorId))
        .where(where),
    ]);

    const data: AuditActionRow[] = rows.map((row) => ({
      ...row,
      // Cai para o e-mail preservado no JSON quando a conta do ator não existe mais.
      actorEmail: row.actorEmail ?? readActorEmail(row.after),
      actorName: row.actorName?.trim() || null,
    }));

    return paginate(data, filters, Number(total));
  }
}

function readActorEmail(after: unknown): string | null {
  if (after && typeof after === "object" && "actorEmail" in after) {
    const value = (after as { actorEmail?: unknown }).actorEmail;
    return typeof value === "string" ? value : null;
  }
  return null;
}
