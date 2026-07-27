import { z } from "zod";

/** Espelha o enum `purchase_type` de `products` — AUTO cobra na hora (PIX/Asaas), MANUAL abre uma solicitação de suporte. */
export const PLAN_PURCHASE_TYPES = ["auto", "manual"] as const;
export type PlanPurchaseType = (typeof PLAN_PURCHASE_TYPES)[number];

export const planIdParamDto = z.object({ id: z.coerce.number().int().positive() });

/** Filtros da listagem administrativa de planos (`GET /api/plans`). */
export const planFiltersDto = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(20),
  sortBy: z.string().optional(),
  sortDirection: z.enum(["asc", "desc"]).optional(),
  search: z.string().optional(),
  purchaseType: z.enum(PLAN_PURCHASE_TYPES).optional(),
  isActive: z
    .enum(["true", "false"])
    .optional()
    .transform((value) => (value === undefined ? undefined : value === "true")),
});

export type PlanFilters = z.infer<typeof planFiltersDto>;

/**
 * Corpo de criação/edição de plano. `price` e `earningsMonthly` chegam como número e são gravados
 * como string decimal — `moneyColumn`/`percentageColumn` são `decimal`, e o driver mysql2 devolve
 * decimais como string para não perder precisão em float.
 *
 * `earningsMonthly` é limitado a 999.99 pela precisão da coluna (decimal 5,2); acima disso o MySQL
 * truncaria silenciosamente em modo não-estrito. Validar aqui evita gravar um número diferente do
 * que o admin digitou — e este campo alimenta o rendimento diário real (`cron.ts:94-127`).
 */
export const planInputDto = z.object({
  name: z.string().trim().min(1, "Nome é obrigatório").max(255, "Nome deve ter no máximo 255 caracteres"),
  description: z.string().trim().min(1, "Descrição é obrigatória"),
  price: z.coerce.number().nonnegative("Valor não pode ser negativo").max(999_999_999_999.99),
  earningsMonthly: z.coerce
    .number()
    .nonnegative("Rentabilidade não pode ser negativa")
    .max(999.99, "Rentabilidade mensal deve ser no máximo 999,99%"),
  purchaseType: z.enum(PLAN_PURCHASE_TYPES),
  isActive: z.boolean().optional().default(true),
});

export type PlanInput = z.infer<typeof planInputDto>;
