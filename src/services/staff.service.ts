import { and, eq, isNull, ne, sql } from "drizzle-orm";
import { db } from "../infrastructure/database/client";
import { roles, staffUsers } from "../infrastructure/database/schema";
import { offsetFor, paginate, type PaginationParams } from "../shared/http/pagination";
import { resolveSort } from "../shared/http/sorting";
import { ConflictError, ForbiddenError, NotFoundError } from "../shared/errors";
import { assertCanGrant, assertStaffManageSurvives, type Permission } from "../shared/permissions/permissions";
import { hashPassword } from "../shared/security/password";

/** Mesmo padrão de `isDuplicateNameError` em `roles.service.ts`/`isDuplicateKeyError` em `payments/payment.service.ts`. */
function isDuplicateEmailError(error: unknown): boolean {
  const code = (error as { code?: string } | undefined)?.code;
  if (code === "ER_DUP_ENTRY") return true;

  const causeCode = (error as { cause?: { code?: string } } | undefined)?.cause?.code;
  return causeCode === "ER_DUP_ENTRY";
}

const staffColumns = {
  id: staffUsers.id,
  name: staffUsers.name,
  surname: staffUsers.surname,
  email: staffUsers.email,
  roleId: staffUsers.roleId,
  roleName: roles.name,
  // `sql<number>` (não `<boolean>`) de propósito — o driver mysql2 devolve
  // expressões booleanas cruas do MySQL como 1/0, não `true`/`false` (mesmo
  // padrão de `statusExpr` em `network.service.ts`); tipar como `boolean`
  // aqui seria só um rótulo do TypeScript sem coerção real em runtime.
  isActive: sql<number>`${staffUsers.deletedAt} IS NULL`,
  createdAt: staffUsers.createdAt,
};

export class StaffService {
  static async list(pagination: Partial<PaginationParams> = {}) {
    const page = pagination.page ?? 1;
    const limit = pagination.limit ?? 20;
    const orderBy = resolveSort(staffColumns, pagination, staffUsers.id);

    const [rows, [{ total }]] = await Promise.all([
      db
        .select(staffColumns)
        .from(staffUsers)
        .innerJoin(roles, eq(staffUsers.roleId, roles.id))
        .orderBy(orderBy)
        .limit(limit)
        .offset(offsetFor({ page, limit })),
      db.select({ total: sql<number>`count(*)` }).from(staffUsers),
    ]);

    return paginate(rows, { page, limit }, Number(total));
  }

  static async getById(staffId: number) {
    const [staff] = await db
      .select(staffColumns)
      .from(staffUsers)
      .innerJoin(roles, eq(staffUsers.roleId, roles.id))
      .where(eq(staffUsers.id, staffId));

    if (!staff) throw new NotFoundError("Staff inexistente");
    return staff;
  }

  private static async getRoleOrThrow(roleId: number) {
    const [role] = await db.select().from(roles).where(eq(roles.id, roleId));
    if (!role) throw new NotFoundError("Papel inexistente");
    return role;
  }

  /**
   * Conta staff ativo (`deletedAt IS NULL`) que ainda ficaria com
   * `staff.manage` depois de uma mudança envolvendo `excludingStaffId` —
   * mesma lógica de `RolesService.countActiveStaffManageHoldersExcludingRole`,
   * mas excluindo um staff específico em vez de um papel inteiro (usada em
   * `reassignRole`/`deactivate`, onde é um único staff que está prestes a
   * perder a permissão, não todo mundo que tem um determinado papel).
   */
  private static async countActiveStaffManageHoldersExcludingStaff(excludingStaffId: number): Promise<number> {
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(staffUsers)
      .innerJoin(roles, eq(staffUsers.roleId, roles.id))
      .where(and(isNull(staffUsers.deletedAt), ne(staffUsers.id, excludingStaffId), sql`JSON_CONTAINS(${roles.permissions}, '"staff.manage"')`));

    return Number(count);
  }

  static async create(
    data: { name: string; surname: string; email: string; password: string; roleId: number },
    actorPermissions: readonly Permission[],
  ) {
    const role = await StaffService.getRoleOrThrow(data.roleId);
    assertCanGrant(actorPermissions, role.permissions);

    try {
      const [created] = await db
        .insert(staffUsers)
        .values({
          name: data.name,
          surname: data.surname,
          email: data.email,
          password: await hashPassword(data.password),
          roleId: data.roleId,
        })
        .$returningId();

      const [staff] = await db
        .select(staffColumns)
        .from(staffUsers)
        .innerJoin(roles, eq(staffUsers.roleId, roles.id))
        .where(eq(staffUsers.id, created.id));
      return staff;
    } catch (error) {
      if (isDuplicateEmailError(error)) throw new ConflictError("Já existe um staff com esse e-mail.");
      throw error;
    }
  }

  static async reassignRole(staffId: number, newRoleId: number, actorPermissions: readonly Permission[]) {
    const [existingStaff] = await db.select().from(staffUsers).where(eq(staffUsers.id, staffId));
    if (!existingStaff) throw new NotFoundError("Staff inexistente");

    const newRole = await StaffService.getRoleOrThrow(newRoleId);
    assertCanGrant(actorPermissions, newRole.permissions);

    const currentRole = await StaffService.getRoleOrThrow(existingStaff.roleId);
    const removesStaffManage = currentRole.permissions.includes("staff.manage") && !newRole.permissions.includes("staff.manage");
    if (removesStaffManage) {
      const survivingCount = await StaffService.countActiveStaffManageHoldersExcludingStaff(staffId);
      assertStaffManageSurvives(survivingCount);
    }

    await db.update(staffUsers).set({ roleId: newRoleId }).where(eq(staffUsers.id, staffId));

    const [staff] = await db
      .select(staffColumns)
      .from(staffUsers)
      .innerJoin(roles, eq(staffUsers.roleId, roles.id))
      .where(eq(staffUsers.id, staffId));
    return staff;
  }

  /** Auto-desativação bloqueada incondicionalmente — sem motivo legítimo de alguém desativar a própria conta por esta rota. */
  static async deactivate(staffId: number, actorId: number) {
    if (staffId === actorId) {
      throw new ForbiddenError("Você não pode desativar a própria conta.");
    }

    const [existingStaff] = await db.select().from(staffUsers).where(eq(staffUsers.id, staffId));
    if (!existingStaff) throw new NotFoundError("Staff inexistente");
    if (existingStaff.deletedAt) throw new ConflictError("Este staff já está desativado.");

    const currentRole = await StaffService.getRoleOrThrow(existingStaff.roleId);
    if (currentRole.permissions.includes("staff.manage")) {
      const survivingCount = await StaffService.countActiveStaffManageHoldersExcludingStaff(staffId);
      assertStaffManageSurvives(survivingCount);
    }

    await db.update(staffUsers).set({ deletedAt: new Date() }).where(eq(staffUsers.id, staffId));
    return { status: true, message: "Staff desativado com sucesso" };
  }
}
