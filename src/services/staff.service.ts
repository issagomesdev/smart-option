import { and, eq, isNull, ne, sql } from "drizzle-orm";
import { db } from "../infrastructure/database/client";
import { roles, staffRefreshTokens, staffUsers } from "../infrastructure/database/schema";
import { offsetFor, paginate, type PaginationParams } from "../shared/http/pagination";
import { resolveSort } from "../shared/http/sorting";
import { ConflictError, ForbiddenError, NotFoundError } from "../shared/errors";
import { assertCanGrant, assertStaffManageSurvives, type Permission } from "../shared/permissions/permissions";
import { hashPassword } from "../shared/security/password";
import { recordAudit, type AuditActor } from "../shared/audit/audit-log";

/**
 * Administrador principal — a conta semeada em `db:seed`, com que o painel é instalado e que os
 * ambientes de demonstração assumem existir. Protegida contra exclusão da mesma forma que
 * `roles.isSystem` protege os papéis padrão.
 */
export const PROTECTED_STAFF_ID = 1;

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
   * `reassignRole`/`remove`, onde é um único staff que está prestes a
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
    actor: AuditActor | null = null,
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

      await recordAudit({
        action: "staff.created",
        entityType: "staff_users",
        entityId: created.id,
        actor,
        after: { name: data.name, surname: data.surname, email: data.email, roleId: data.roleId, roleName: role.name },
      });

      return staff;
    } catch (error) {
      if (isDuplicateEmailError(error)) throw new ConflictError("Já existe um staff com esse e-mail.");
      throw error;
    }
  }

  /**
   * Edita nome, sobrenome, e-mail e (opcionalmente) a senha de um staff. Exige `staff.manage`, o
   * mesmo gate do resto deste recurso — qualquer portador dessa permissão pode editar qualquer
   * membro da equipe, inclusive redefinir a senha sem informar a atual (quem gerencia a equipe não
   * a conhece, e o ponto de uma redefinição administrativa é destravar a conta sem depender disso).
   *
   * Como a permissão sozinha autoriza a ação, a contenção é **rastreabilidade**: toda edição grava
   * em `audit_logs` quem alterou o quê, com o estado antes e depois. Redefinições de senha ficam
   * explicitamente marcadas (`passwordChanged`), sem nunca registrar a senha nem o hash.
   */
  static async update(
    staffId: number,
    data: { name: string; surname: string; email: string; password?: string },
    actor: { id: number; email: string } | null,
  ) {
    const [existingStaff] = await db.select().from(staffUsers).where(eq(staffUsers.id, staffId));
    if (!existingStaff) throw new NotFoundError("Staff inexistente");

    const passwordChanged = Boolean(data.password);

    try {
      await db
        .update(staffUsers)
        .set({
          name: data.name,
          surname: data.surname,
          email: data.email,
          // Ausente ou vazio = manter a senha atual; só re-hasheia quando veio uma senha nova.
          ...(passwordChanged ? { password: await hashPassword(data.password!) } : {}),
        })
        .where(eq(staffUsers.id, staffId));
    } catch (error) {
      if (isDuplicateEmailError(error)) throw new ConflictError("Já existe um staff com esse e-mail.");
      throw error;
    }

    await recordAudit({
      action: "staff.updated",
      entityType: "staff_users",
      entityId: staffId,
      actor,
      before: { name: existingStaff.name, surname: existingStaff.surname, email: existingStaff.email },
      // `passwordChanged` é um booleano de propósito: registra QUE a senha foi redefinida, sem
      // guardar o valor nem o hash — a trilha de auditoria não pode virar um vetor de vazamento.
      after: { name: data.name, surname: data.surname, email: data.email, passwordChanged },
    });

    const [staff] = await db
      .select(staffColumns)
      .from(staffUsers)
      .innerJoin(roles, eq(staffUsers.roleId, roles.id))
      .where(eq(staffUsers.id, staffId));
    return staff;
  }

  static async reassignRole(
    staffId: number,
    newRoleId: number,
    actorPermissions: readonly Permission[],
    actor: AuditActor | null = null,
  ) {
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

    await recordAudit({
      action: "staff.role_changed",
      entityType: "staff_users",
      entityId: staffId,
      actor,
      before: { roleId: currentRole.id, roleName: currentRole.name, permissions: currentRole.permissions },
      after: { roleId: newRole.id, roleName: newRole.name, permissions: newRole.permissions },
    });

    const [staff] = await db
      .select(staffColumns)
      .from(staffUsers)
      .innerJoin(roles, eq(staffUsers.roleId, roles.id))
      .where(eq(staffUsers.id, staffId));
    return staff;
  }

  /**
   * Exclui um staff definitivamente.
   *
   * Três guardas, cada uma por um motivo diferente:
   *
   * - **Administrador principal (id 1)**: é a conta semeada com que o painel é instalado e a única
   *   referenciada por nome na documentação e nos ambientes de demonstração. Excluí-la deixaria o
   *   sistema sem a conta de origem, então é bloqueada incondicionalmente — nem o próprio id 1 pode.
   * - **Auto-exclusão**: sem motivo legítimo de alguém apagar a própria conta por esta rota, e o
   *   custo de um clique errado é perder o acesso na hora.
   * - **Último portador de `staff.manage`**: `assertStaffManageSurvives` impede o lockout de ninguém
   *   mais conseguir administrar a equipe.
   *
   * A exclusão é física, não `deletedAt`. A trilha de auditoria não depende da linha sobreviver:
   * `audit_logs.actor_id` não tem FK e o e-mail do autor é desnormalizado dentro de `after`
   * justamente para o caso da conta ser removida depois (ver `recordAudit`).
   */
  static async remove(staffId: number, actorId: number, actor: AuditActor | null = null) {
    if (staffId === PROTECTED_STAFF_ID) {
      throw new ForbiddenError("O administrador principal não pode ser excluído.");
    }

    if (staffId === actorId) {
      throw new ForbiddenError("Você não pode excluir a própria conta.");
    }

    const [existingStaff] = await db.select().from(staffUsers).where(eq(staffUsers.id, staffId));
    if (!existingStaff) throw new NotFoundError("Staff inexistente");

    const currentRole = await StaffService.getRoleOrThrow(existingStaff.roleId);
    if (currentRole.permissions.includes("staff.manage")) {
      const survivingCount = await StaffService.countActiveStaffManageHoldersExcludingStaff(staffId);
      assertStaffManageSurvives(survivingCount);
    }

    // `staff_refresh_tokens.staff_user_id` tem FK sem ON DELETE CASCADE: apagar o staff sem limpar
    // as sessões dele primeiro é rejeitado pelo MySQL. Numa transação para não deixar tokens órfãos
    // caso o DELETE seguinte falhe.
    await db.transaction(async (tx) => {
      await tx.delete(staffRefreshTokens).where(eq(staffRefreshTokens.staffUserId, staffId));
      await tx.delete(staffUsers).where(eq(staffUsers.id, staffId));
    });

    await recordAudit({
      action: "staff.deleted",
      entityType: "staff_users",
      entityId: staffId,
      actor,
      before: {
        name: existingStaff.name,
        surname: existingStaff.surname,
        email: existingStaff.email,
        roleId: currentRole.id,
        roleName: currentRole.name,
      },
      after: null,
    });

    return { status: true, message: "Staff excluído com sucesso" };
  }
}
