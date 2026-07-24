import { and, eq, isNull, ne, sql } from "drizzle-orm";
import { db } from "../infrastructure/database/client";
import { roles, staffUsers } from "../infrastructure/database/schema";
import { ConflictError, NotFoundError } from "../shared/errors";
import { assertCanGrant, assertStaffManageSurvives, type Permission } from "../shared/permissions/permissions";

interface RoleInput {
  name: string;
  description?: string;
  permissions: Permission[];
}

/**
 * Mesmo padrão de `isDuplicateKeyError` em `payments/payment.service.ts`: o
 * Drizzle envolve o erro do driver mysql2 num `DrizzleQueryError` e move o
 * código original (`ER_DUP_ENTRY`) para `error.cause`. Duplicado aqui (não
 * extraído para um módulo compartilhado) para não tocar num arquivo já
 * fechado da Fase 3 por uma mudança fora do escopo desta parte.
 */
function isDuplicateNameError(error: unknown): boolean {
  const code = (error as { code?: string } | undefined)?.code;
  if (code === "ER_DUP_ENTRY") return true;

  const causeCode = (error as { cause?: { code?: string } } | undefined)?.cause?.code;
  return causeCode === "ER_DUP_ENTRY";
}

export class RolesService {
  static async list() {
    return db.select().from(roles).orderBy(roles.id);
  }

  static async getById(id: number) {
    const [role] = await db.select().from(roles).where(eq(roles.id, id));
    if (!role) throw new NotFoundError("Papel inexistente");
    return role;
  }

  /**
   * Conta staff ativo (`deletedAt IS NULL`) que ainda ficaria com
   * `staff.manage` depois de uma mudança — usado só quando a edição de um
   * papel está prestes a remover essa permissão dele, para alimentar
   * `assertStaffManageSurvives`. `excludingRoleId` exclui o próprio papel
   * sendo editado (seus portadores perderiam a permissão com esta mudança).
   */
  private static async countActiveStaffManageHoldersExcludingRole(excludingRoleId: number): Promise<number> {
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(staffUsers)
      .innerJoin(roles, eq(staffUsers.roleId, roles.id))
      .where(and(isNull(staffUsers.deletedAt), ne(staffUsers.roleId, excludingRoleId), sql`JSON_CONTAINS(${roles.permissions}, '"staff.manage"')`));

    return Number(count);
  }

  static async create(data: RoleInput, actorPermissions: readonly Permission[]) {
    assertCanGrant(actorPermissions, data.permissions);

    try {
      const [created] = await db
        .insert(roles)
        .values({ name: data.name, description: data.description, permissions: data.permissions })
        .$returningId();

      const [role] = await db.select().from(roles).where(eq(roles.id, created.id));
      return role;
    } catch (error) {
      if (isDuplicateNameError(error)) throw new ConflictError("Já existe um papel com esse nome.");
      throw error;
    }
  }

  static async update(id: number, data: RoleInput, actorPermissions: readonly Permission[]) {
    assertCanGrant(actorPermissions, data.permissions);

    const [existing] = await db.select().from(roles).where(eq(roles.id, id));
    if (!existing) throw new NotFoundError("Papel inexistente");

    const removesStaffManage = existing.permissions.includes("staff.manage") && !data.permissions.includes("staff.manage");
    if (removesStaffManage) {
      const survivingCount = await RolesService.countActiveStaffManageHoldersExcludingRole(id);
      assertStaffManageSurvives(survivingCount);
    }

    try {
      await db
        .update(roles)
        .set({ name: data.name, description: data.description, permissions: data.permissions })
        .where(eq(roles.id, id));
    } catch (error) {
      if (isDuplicateNameError(error)) throw new ConflictError("Já existe um papel com esse nome.");
      throw error;
    }

    const [updated] = await db.select().from(roles).where(eq(roles.id, id));
    return updated;
  }

  static async delete(id: number) {
    const [existing] = await db.select().from(roles).where(eq(roles.id, id));
    if (!existing) throw new NotFoundError("Papel inexistente");

    if (existing.isSystem) {
      throw new ConflictError("Papéis do sistema não podem ser excluídos.");
    }

    const [staffWithRole] = await db.select({ id: staffUsers.id }).from(staffUsers).where(eq(staffUsers.roleId, id)).limit(1);
    if (staffWithRole) {
      throw new ConflictError("Este papel está atribuído a pelo menos um staff e não pode ser excluído.");
    }

    await db.delete(roles).where(eq(roles.id, id));
    return { status: true, message: "Papel excluído com sucesso" };
  }
}
