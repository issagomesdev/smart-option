import { z } from "zod";

const idParam = z.object({ id: z.coerce.number().int().positive() });

export const updateStaffUserDto = z.object({
  id: z.coerce.number().int().positive(),
  name: z.string().min(1).max(255),
  surname: z.string().min(1).max(255),
  email: z.email(),
});

export const updatePassDto = z.object({
  userId: z.coerce.number().int().positive(),
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

export const dashBalanceParamsDto = z.object({
  user_id: z.string(),
  product_id: z.string(),
  period: z.string(),
});

export const networkIdParamDto = idParam;

export const networkFiltersDto = z
  .object({
    id: z.string().optional().default(""),
    name: z.string().optional().default(""),
    level: z.string().optional().default("all"),
    status: z.string().optional().default("all"),
  })
  .optional();

const listFiltersBase = {
  id: z.string().optional().default(""),
  name: z.string().optional().default(""),
  value: z.string().optional().default(""),
  status: z.string().optional().default("all"),
  created_at: z.string().optional(),
};

export const withdrawalFiltersDto = z.object(listFiltersBase);
export const depositFiltersDto = z.object(listFiltersBase);
export const subscriptionFiltersDto = z.object({ ...listFiltersBase, product_id: z.string().optional().default("all") });
export const supportFiltersDto = z.object({
  id: z.string().optional().default(""),
  name: z.string().optional().default(""),
  type: z.string().optional().default("all"),
  is_read: z.string().optional().default("all"),
  created_at: z.string().optional(),
});

export const extractFiltersDto = z
  .object({
    value: z.string().optional(),
    origin: z.string().optional(),
    created_at: z.string().optional(),
  })
  .optional();

export const requestsUserIdParamDto = z.object({ id: z.coerce.number().int().positive().optional() });

export const resWithdrawalDto = z.object({
  res: z.boolean(),
  id: z.coerce.number().int().positive(),
  observation: z.string().optional(),
});

export const wasReadParamsDto = z.object({
  id: z.coerce.number().int().positive(),
  status: z.coerce.number().int().min(0).max(1),
});
