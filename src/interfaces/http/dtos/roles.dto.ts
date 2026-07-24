import { z } from "zod";
import { PERMISSIONS } from "../../../shared/permissions/permissions";

export const roleIdParamDto = z.object({ id: z.coerce.number().int().positive() });

const permissionsField = z.array(z.enum(PERMISSIONS)).default([]);

export const createRoleDto = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(255).optional(),
  permissions: permissionsField,
});

export const updateRoleDto = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(255).optional(),
  permissions: permissionsField,
});
