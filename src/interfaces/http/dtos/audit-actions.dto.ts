import { z } from "zod";
import { AUDIT_ACTIONS } from "../../../shared/audit/audit-log";

/**
 * Filtros da trilha de ações administrativas (`POST /api/audit/actions`).
 *
 * `period` é opcional, como na Auditoria Financeira: sem ele, nenhum filtro de data é aplicado e a
 * consulta devolve o histórico completo — o padrão que faz sentido para uma investigação.
 */
export const auditActionFiltersDto = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(20),
  period: z.enum(["today", "7d", "30d", "custom"]).optional(),
  start: z.string().optional(),
  end: z.string().optional(),
  action: z.enum(AUDIT_ACTIONS).optional(),
  entityType: z.string().max(100).optional(),
  actorId: z.coerce.number().int().positive().optional(),
  search: z.string().optional(),
});

export type AuditActionFilters = z.infer<typeof auditActionFiltersDto>;
