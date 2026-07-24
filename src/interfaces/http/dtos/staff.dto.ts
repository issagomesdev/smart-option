import { z } from "zod";

const paginationParams = {
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(20),
  sortBy: z.string().optional(),
  sortDirection: z.enum(["asc", "desc"]).optional(),
};

export const staffIdParamDto = z.object({ id: z.coerce.number().int().positive() });

export const staffListQueryDto = z.object({ ...paginationParams });

export const createStaffDto = z.object({
  name: z.string().min(1).max(255),
  surname: z.string().min(1).max(255),
  email: z.email(),
  password: z.string().min(8, "A senha deve ter pelo menos 8 caracteres"),
  roleId: z.coerce.number().int().positive(),
});

export const updateStaffRoleDto = z.object({
  roleId: z.coerce.number().int().positive(),
});
