import { z } from "zod";

/**
 * Mesmos 10 valores de `WalletOrigin` (`src/wallet/wallet.service.ts`) — repetidos aqui como array
 * `zod` porque o enum de tipos precisa existir em tempo de execução para validar a query, não só
 * como tipo TypeScript.
 */
export const AUDIT_TYPES = [
  "deposit",
  "withdrawal",
  "earnings",
  "profitability",
  "subscription",
  "tuition",
  "transfer_in",
  "transfer_out",
  "admin_adjustment",
  "diamond_tax",
] as const;

/**
 * Filtros da Auditoria Financeira (`POST /api/audit`). `status` é simplificado para duas categorias —
 * `"completed"` (só `wallet_transactions`, sempre concluído) e `"pending"` (saques/checkouts ainda em
 * aberto) — em vez dos 6 valores brutos e heterogêneos que as 3 fontes usam internamente (`concluido`,
 * `pending`/`authorized`, `PENDING`/`AUTHORIZED`/`IN_ANALYSIS`); o status bruto de cada linha continua
 * visível na resposta, só não é filtrável individualmente por essa distinção mais fina. `period` é
 * opcional de propósito (diferente do dashboard, que sempre teve um período padrão): a Auditoria é um
 * histórico completo por padrão — sem `period`, nenhum filtro de data é aplicado.
 */
export const auditFiltersDto = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(20),
  sortBy: z.string().optional(),
  // `resolveSort` (a allowlist compartilhada de ordenação) cai em `asc` quando `sortDirection` não é
  // informado — correto como default genérico, mas errado para um histórico de auditoria, onde "mais
  // recente primeiro" é a expectativa óbvia. Fixamos o default aqui, não em `resolveSort` (que
  // continua genérico para os outros recursos que já dependem do `asc` implícito).
  sortDirection: z.enum(["asc", "desc"]).optional().default("desc"),
  period: z.enum(["today", "7d", "30d", "custom"]).optional(),
  start: z.string().optional(),
  end: z.string().optional(),
  type: z.enum(AUDIT_TYPES).optional(),
  status: z.enum(["completed", "pending"]).optional(),
  userId: z.coerce.number().int().positive().optional(),
  minValue: z.coerce.number().nonnegative().optional(),
  maxValue: z.coerce.number().nonnegative().optional(),
  search: z.string().optional(),
});

export type AuditFilters = z.infer<typeof auditFiltersDto>;
