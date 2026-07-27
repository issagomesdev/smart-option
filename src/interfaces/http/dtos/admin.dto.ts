import { z } from "zod";

const idParam = z.object({ id: z.coerce.number().int().positive() });

/**
 * Aplicado às rotas de listagem paginadas — mantém `page`/`limit` com
 * defaults e um teto sensato. `sortBy` é texto livre de propósito — a
 * validação de quais colunas são aceitas acontece no service (allowlist por
 * recurso, `shared/http/sorting.ts#resolveSort`), não aqui, já que cada
 * recurso tem colunas ordenáveis diferentes.
 */
const paginationParams = {
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(20),
  sortBy: z.string().optional(),
  sortDirection: z.enum(["asc", "desc"]).optional(),
};

// Sem `id`/`userId` de propósito: o alvo destas duas rotas de self-service é
// sempre `req.user!.id` (a sessão autenticada), nunca um valor vindo do
// cliente — aceitar um id no corpo permitia qualquer staff editar/trocar a
// senha de qualquer outro staff (bug real, corrigido junto com este DTO).
export const updateStaffUserDto = z.object({
  name: z.string().min(1).max(255),
  surname: z.string().min(1).max(255),
  email: z.email(),
});

export const updatePassDto = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8, "A nova senha deve ter pelo menos 8 caracteres"),
});

export const botUserSearchParamDto = z.object({ search: z.string().min(1) });

export const botUsersFiltersDto = z.object({
  user_id: z.string().optional().default(""),
  name: z.string().optional().default(""),
  email: z.string().optional().default(""),
  product_id: z.string().optional().default("all"),
  status: z.string().optional().default("all"),
  is_active: z.string().optional().default("all"),
  created_at: z.string().optional(),
  telegram: z.string().optional(),
  balance: z.string().optional(),
  ...paginationParams,
});

export const botUserIdParamDto = idParam;

export const updateBotUserDto = z.object({
  id: z.coerce.number().int().positive(),
  name: z.string().min(1).max(255),
  email: z.email(),
  password: z.string().min(6).optional(),
  phone_number: z.string().min(1).max(255),
  adress: z.string().min(1).max(255),
  pix_code: z.string().min(1).max(255),
  product_id: z.coerce.number().int().positive().optional(),
});

export const botUserStatusParamsDto = z.object({
  id: z.coerce.number().int().positive(),
  status: z.coerce.number().int().min(0).max(1),
});

export const transfValuesAdminDto = z.object({
  user_id: z.coerce.number().int().positive(),
  value: z.string().regex(/^\d+(\.\d{1,2})?$/, "Valor inválido"),
  type: z.enum(["sum", "subtract"]),
});

/**
 * Filtro de período do novo agregador do dashboard (`/api/dashboard/summary`) e da Auditoria
 * Financeira (`/api/audit`) — `start`/`end` só são exigidos quando `period: "custom"` (validado em
 * `resolvePeriod`, não aqui, já que a regra depende da combinação dos três campos, não de cada um
 * isoladamente). `userId`/`productId` são o recorte opcional que reaproveita a busca por
 * usuário/produto que já existia no dashboard antigo.
 */
export const periodQueryDto = z.object({
  period: z.enum(["all", "today", "7d", "30d", "custom"]).optional().default("today"),
  start: z.string().optional(),
  end: z.string().optional(),
  userId: z.coerce.number().int().positive().optional(),
  productId: z.coerce.number().int().positive().optional(),
});

export const networkIdParamDto = idParam;

export const networkFiltersDto = z
  .object({
    id: z.string().optional().default(""),
    name: z.string().optional().default(""),
    level: z.string().optional().default("all"),
    status: z.string().optional().default("all"),
    ...paginationParams,
  })
  .optional();

const listFiltersBase = {
  id: z.string().optional().default(""),
  name: z.string().optional().default(""),
  value: z.string().optional().default(""),
  status: z.string().optional().default("all"),
  created_at: z.string().optional(),
  ...paginationParams,
};

export const withdrawalFiltersDto = z.object(listFiltersBase);
export const depositFiltersDto = z.object(listFiltersBase);
export const subscriptionFiltersDto = z.object({
  ...listFiltersBase,
  product_id: z.string().optional().default("all"),
});
export const supportFiltersDto = z.object({
  id: z.string().optional().default(""),
  name: z.string().optional().default(""),
  type: z.string().optional().default("all"),
  is_read: z.string().optional().default("all"),
  created_at: z.string().optional(),
  ...paginationParams,
});

export const extractFiltersDto = z
  .object({
    value: z.string().optional(),
    origin: z.string().optional(),
    created_at: z.string().optional(),
  })
  .optional();

// `id` também aceita o literal `"all"` — é assim que o painel pede a fila
// global (todos os usuários) nas rotas de listagem (`withdrawal`/`deposit`/
// `support`/`subscription`); o route handler já convertia `Number("all") ||
// null` corretamente, mas a validação aqui rejeitava a string antes disso
// (`z.coerce.number()` produz `NaN`, que falha em `.positive()`).
export const requestsUserIdParamDto = z.object({
  id: z.union([z.literal("all"), z.coerce.number().int().positive()]).optional(),
});

export const resWithdrawalDto = z.object({
  res: z.boolean(),
  id: z.coerce.number().int().positive(),
  observation: z.string().optional(),
});

export const wasReadParamsDto = z.object({
  id: z.coerce.number().int().positive(),
  status: z.coerce.number().int().min(0).max(1),
});
