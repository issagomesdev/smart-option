import { eq, inArray } from "drizzle-orm";
import { afterEach, describe, expect, it } from "vitest";
import { db } from "../infrastructure/database/client";
import { roles, staffUsers } from "../infrastructure/database/schema";
import type { Permission } from "../shared/permissions/permissions";
import { StaffService } from "./staff.service";

/**
 * Integração contra o banco real (mesmo padrão de `roles.service.test.ts`).
 * O staff real (`admin@admin.com`, id 1, `roleId=1`) nunca é mutado aqui —
 * mesma disciplina já documentada em `authentication.service.test.ts` e
 * `roles.service.test.ts`: a suíte E2E do painel depende dessa credencial, e
 * o caminho negativo de `assertStaffManageSurvives` não é reproduzível sem
 * mexer nela (já coberto isoladamente em `shared/permissions/permissions.test.ts`).
 */
describe("StaffService (integração, banco real)", () => {
  const createdStaffIds: number[] = [];
  const createdRoleIds: number[] = [];
  const stamp = Date.now();
  let counter = 0;

  afterEach(async () => {
    if (createdStaffIds.length) {
      await db.delete(staffUsers).where(inArray(staffUsers.id, createdStaffIds));
      createdStaffIds.length = 0;
    }
    if (createdRoleIds.length) {
      await db.delete(roles).where(inArray(roles.id, createdRoleIds));
      createdRoleIds.length = 0;
    }
  });

  async function insertTestRole(permissions: Permission[]) {
    counter += 1;
    const [created] = await db
      .insert(roles)
      .values({ name: `Staff Service Test Role ${stamp}-${counter}`, permissions })
      .$returningId();
    createdRoleIds.push(created.id);
    return created.id;
  }

  async function insertTestStaff(roleId: number, name = "Staff Service Test") {
    counter += 1;
    const [created] = await db
      .insert(staffUsers)
      .values({
        name,
        surname: "Staff",
        email: `staff-service-test-${stamp}-${counter}@test.local`,
        password: "unused-in-this-test",
        roleId,
      })
      .$returningId();
    createdStaffIds.push(created.id);
    return created.id;
  }

  describe("create", () => {
    it("cria um staff novo com o papel concedido pelo ator", async () => {
      const roleId = await insertTestRole(["support.write"]);

      const created = await StaffService.create(
        { name: "Novo", surname: "Staff", email: `staff-create-${stamp}@test.local`, password: "senha-forte-123", roleId },
        ["support.write", "users.write"],
      );
      createdStaffIds.push(created.id);

      expect(created).toMatchObject({ name: "Novo", surname: "Staff", roleId, isActive: 1 });
    });

    it("recusa criar um staff com um papel cujas permissões o ator não possui (guarda contra auto-escalação)", async () => {
      const roleId = await insertTestRole(["staff.manage"]);

      await expect(
        StaffService.create(
          { name: "X", surname: "Y", email: `staff-escalacao-${stamp}@test.local`, password: "senha-forte-123", roleId },
          ["support.write"],
        ),
      ).rejects.toThrow("Você não pode conceder permissões que não possui");
    });

    it("recusa e-mail duplicado com um erro de conflito legível", async () => {
      const roleId = await insertTestRole([]);
      const email = `staff-duplicado-${stamp}@test.local`;

      const first = await StaffService.create({ name: "A", surname: "A", email, password: "senha-forte-123", roleId }, []);
      createdStaffIds.push(first.id);

      await expect(StaffService.create({ name: "B", surname: "B", email, password: "senha-forte-123", roleId }, [])).rejects.toThrow(
        "Já existe um staff com esse e-mail",
      );
    });

    it("lança NotFoundError para papel inexistente", async () => {
      await expect(
        StaffService.create({ name: "X", surname: "Y", email: `staff-sem-papel-${stamp}@test.local`, password: "senha-forte-123", roleId: 999999999 }, []),
      ).rejects.toThrow("Papel inexistente");
    });
  });

  describe("list", () => {
    it("inclui o nome do papel e o status ativo/inativo de cada staff", async () => {
      const roleId = await insertTestRole(["support.write"]);
      const staffId = await insertTestStaff(roleId);

      const result = await StaffService.list({ page: 1, limit: 100 });
      const found = result.data.find((staff) => staff.id === staffId);

      expect(found).toMatchObject({ roleId, isActive: 1 });
      expect(found!.roleName).toBe((await db.select().from(roles).where(eq(roles.id, roleId)))[0].name);
    });

    it("ordena por name asc/desc via sortBy/sortDirection", async () => {
      const roleId = await insertTestRole([]);
      const idA = await insertTestStaff(roleId, `AAA Sort Staff ${stamp}`);
      const idZ = await insertTestStaff(roleId, `ZZZ Sort Staff ${stamp}`);

      const asc = await StaffService.list({ page: 1, limit: 100, sortBy: "name", sortDirection: "asc" });
      expect(asc.data.findIndex((s) => s.id === idA)).toBeLessThan(asc.data.findIndex((s) => s.id === idZ));

      const desc = await StaffService.list({ page: 1, limit: 100, sortBy: "name", sortDirection: "desc" });
      expect(desc.data.findIndex((s) => s.id === idZ)).toBeLessThan(desc.data.findIndex((s) => s.id === idA));
    });

    it("cai no fallback (id) quando sortBy é desconhecido, sem lançar erro", async () => {
      const result = await StaffService.list({ page: 1, limit: 100, sortBy: "not-a-real-column" });
      expect(result.data.length).toBeGreaterThan(0);
    });
  });

  describe("getById", () => {
    it("devolve o staff com o nome do papel e o status ativo", async () => {
      const roleId = await insertTestRole(["support.write"]);
      const staffId = await insertTestStaff(roleId);

      const staff = await StaffService.getById(staffId);

      expect(staff).toMatchObject({ id: staffId, roleId, isActive: 1 });
      expect(staff.roleName).toBe((await db.select().from(roles).where(eq(roles.id, roleId)))[0].name);
    });

    it("lança NotFoundError para staff inexistente", async () => {
      await expect(StaffService.getById(999999999)).rejects.toThrow("Staff inexistente");
    });
  });

  describe("reassignRole", () => {
    it("reatribui o papel de um staff quando o ator possui as permissões do papel novo", async () => {
      const oldRoleId = await insertTestRole([]);
      const newRoleId = await insertTestRole(["support.write"]);
      const staffId = await insertTestStaff(oldRoleId);

      const updated = await StaffService.reassignRole(staffId, newRoleId, ["support.write"]);
      expect(updated.roleId).toBe(newRoleId);
    });

    it("recusa reatribuir um papel cujas permissões o ator não possui", async () => {
      const oldRoleId = await insertTestRole([]);
      const newRoleId = await insertTestRole(["staff.manage"]);
      const staffId = await insertTestStaff(oldRoleId);

      await expect(StaffService.reassignRole(staffId, newRoleId, ["support.write"])).rejects.toThrow(
        "Você não pode conceder permissões que não possui",
      );
    });

    it("permite remover staff.manage de um staff quando outro staff ativo ainda o possui por outro papel", async () => {
      const holderRoleId = await insertTestRole(["staff.manage"]);
      await insertTestStaff(holderRoleId);

      const staffManageRoleId = await insertTestRole(["staff.manage"]);
      const targetStaffId = await insertTestStaff(staffManageRoleId);

      const noManageRoleId = await insertTestRole(["support.write"]);

      const updated = await StaffService.reassignRole(targetStaffId, noManageRoleId, ["staff.manage", "support.write"]);
      expect(updated.roleId).toBe(noManageRoleId);
    });

    it("lança NotFoundError para staff inexistente", async () => {
      const roleId = await insertTestRole([]);
      await expect(StaffService.reassignRole(999999999, roleId, [])).rejects.toThrow("Staff inexistente");
    });
  });

  describe("deactivate", () => {
    it("desativa um staff (soft-delete via deletedAt)", async () => {
      const roleId = await insertTestRole([]);
      const staffId = await insertTestStaff(roleId);

      const result = await StaffService.deactivate(staffId, 999999999);
      expect(result.status).toBe(true);

      const [staff] = await db.select().from(staffUsers).where(eq(staffUsers.id, staffId));
      expect(staff.deletedAt).not.toBeNull();
    });

    it("recusa auto-desativação incondicionalmente", async () => {
      const roleId = await insertTestRole([]);
      const staffId = await insertTestStaff(roleId);

      await expect(StaffService.deactivate(staffId, staffId)).rejects.toThrow("Você não pode desativar a própria conta");
    });

    it("recusa desativar um staff já desativado", async () => {
      const roleId = await insertTestRole([]);
      const staffId = await insertTestStaff(roleId);

      await StaffService.deactivate(staffId, 999999999);
      await expect(StaffService.deactivate(staffId, 999999999)).rejects.toThrow("Este staff já está desativado");
    });

    it("permite desativar um staff com staff.manage quando outro staff ativo ainda o possui por outro papel", async () => {
      const holderRoleId = await insertTestRole(["staff.manage"]);
      await insertTestStaff(holderRoleId);

      const staffManageRoleId = await insertTestRole(["staff.manage"]);
      const targetStaffId = await insertTestStaff(staffManageRoleId);

      const result = await StaffService.deactivate(targetStaffId, 999999999);
      expect(result.status).toBe(true);
    });

    it("lança NotFoundError para staff inexistente", async () => {
      await expect(StaffService.deactivate(999999999, 888888888)).rejects.toThrow("Staff inexistente");
    });
  });
});
