import { eq, inArray } from "drizzle-orm";
import { afterEach, describe, expect, it } from "vitest";
import { db } from "../infrastructure/database/client";
import { roles, staffUsers } from "../infrastructure/database/schema";
import type { Permission } from "../shared/permissions/permissions";
import { RolesService } from "./roles.service";

/**
 * Integração contra o banco real (mesmo padrão de `network.service.test.ts`/
 * `users.service.test.ts`). Os dois papéis semeados pela migration da Fase 5
 * parte 3 (`admin` id 1, `staff` id 2) e o staff real (`admin@admin.com`,
 * `roleId=1`) nunca são mutados aqui — só lidos — pelo mesmo motivo já
 * documentado em `authentication.service.test.ts`: a suíte E2E do painel
 * depende dessa credencial.
 *
 * O caminho negativo de `assertStaffManageSurvives` (bloquear quando a
 * contagem realmente zeraria) já está coberto isoladamente em
 * `shared/permissions/permissions.test.ts` — não é reproduzível aqui sem
 * mexer no staff real, já que ele sempre contribui com `staff.manage` via o
 * papel `admin`. O teste abaixo prova a metade que É seguro exercitar contra
 * o banco real: a query de contagem roda e não bloqueia indevidamente.
 */
describe("RolesService (integração, banco real)", () => {
  const createdRoleIds: number[] = [];
  const createdStaffIds: number[] = [];
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
      .values({ name: `Roles Service Test ${stamp}-${counter}`, permissions })
      .$returningId();
    createdRoleIds.push(created.id);
    return created.id;
  }

  async function insertTestStaff(roleId: number) {
    counter += 1;
    const [created] = await db
      .insert(staffUsers)
      .values({
        name: "Roles Test",
        surname: "Staff",
        email: `roles-test-staff-${stamp}-${counter}@test.local`,
        password: "unused-in-this-test",
        roleId,
      })
      .$returningId();
    createdStaffIds.push(created.id);
    return created.id;
  }

  describe("list", () => {
    it("inclui os dois papéis semeados pela migration (admin com as 6 permissões, staff sem nenhuma)", async () => {
      const result = await RolesService.list();
      const admin = result.find((role) => role.id === 1);
      const staff = result.find((role) => role.id === 2);

      expect(admin).toMatchObject({ name: "admin", isSystem: true });
      expect(admin!.permissions).toHaveLength(6);
      expect(staff).toMatchObject({ name: "staff", isSystem: true, permissions: [] });
    });
  });

  describe("getById", () => {
    it("devolve o papel semeado pela migration", async () => {
      const admin = await RolesService.getById(1);
      expect(admin).toMatchObject({ name: "admin", isSystem: true });
      expect(admin.permissions).toHaveLength(6);
    });

    it("lança NotFoundError para papel inexistente", async () => {
      await expect(RolesService.getById(999999999)).rejects.toThrow("Papel inexistente");
    });
  });

  describe("create", () => {
    it("cria um papel novo com as permissões concedidas pelo ator", async () => {
      const name = `Papel Teste Create ${stamp}`;
      const created = await RolesService.create({ name, description: "criado pelo teste", permissions: ["support.write"] }, [
        "support.write",
        "users.write",
      ]);
      createdRoleIds.push(created.id);

      expect(created).toMatchObject({
        name,
        description: "criado pelo teste",
        permissions: ["support.write"],
        isSystem: false,
      });
    });

    it("recusa conceder uma permissão que o ator não possui (guarda contra auto-escalação)", async () => {
      await expect(
        RolesService.create({ name: `Papel Escalação ${stamp}`, permissions: ["staff.manage"] }, ["support.write"]),
      ).rejects.toThrow("Você não pode conceder permissões que não possui");
    });

    it("recusa nome duplicado com um erro de conflito legível", async () => {
      const name = `Papel Duplicado ${stamp}`;
      const first = await RolesService.create({ name, permissions: [] }, []);
      createdRoleIds.push(first.id);

      await expect(RolesService.create({ name, permissions: [] }, [])).rejects.toThrow("Já existe um papel com esse nome");
    });
  });

  describe("update", () => {
    it("atualiza nome, descrição e permissões", async () => {
      const roleId = await insertTestRole(["support.write"]);

      const updated = await RolesService.update(
        roleId,
        { name: "Renomeado", description: "nova desc", permissions: ["support.write", "users.write"] },
        ["support.write", "users.write"],
      );

      expect(updated).toMatchObject({ name: "Renomeado", description: "nova desc", permissions: ["support.write", "users.write"] });
    });

    it("recusa conceder uma permissão que o ator não possui", async () => {
      const roleId = await insertTestRole([]);

      await expect(RolesService.update(roleId, { name: "X", permissions: ["staff.manage"] }, ["support.write"])).rejects.toThrow(
        "Você não pode conceder permissões que não possui",
      );
    });

    it("lança NotFoundError para papel inexistente", async () => {
      await expect(RolesService.update(999999999, { name: "X", permissions: [] }, [])).rejects.toThrow("Papel inexistente");
    });

    it("permite remover staff.manage de um papel quando outro staff ativo ainda o possui por outro papel", async () => {
      const holderRoleId = await insertTestRole(["staff.manage"]);
      await insertTestStaff(holderRoleId);

      const editedRoleId = await insertTestRole(["staff.manage", "support.write"]);
      await insertTestStaff(editedRoleId);

      const updated = await RolesService.update(editedRoleId, { name: "Sem staff.manage", permissions: ["support.write"] }, [
        "staff.manage",
        "support.write",
      ]);

      expect(updated.permissions).toEqual(["support.write"]);
    });
  });

  describe("delete", () => {
    it("recusa excluir um papel de sistema (isSystem), incondicionalmente", async () => {
      await expect(RolesService.delete(1)).rejects.toThrow("Papéis do sistema não podem ser excluídos");
    });

    it("recusa excluir um papel ainda referenciado por algum staff", async () => {
      const roleId = await insertTestRole([]);
      await insertTestStaff(roleId);

      await expect(RolesService.delete(roleId)).rejects.toThrow("está atribuído a pelo menos um staff");
    });

    it("exclui um papel sem nenhum staff vinculado", async () => {
      const roleId = await insertTestRole([]);

      const result = await RolesService.delete(roleId);
      expect(result.status).toBe(true);
      createdRoleIds.splice(createdRoleIds.indexOf(roleId), 1);

      const [stillThere] = await db.select().from(roles).where(eq(roles.id, roleId));
      expect(stillThere).toBeUndefined();
    });

    it("lança NotFoundError para papel inexistente", async () => {
      await expect(RolesService.delete(999999999)).rejects.toThrow("Papel inexistente");
    });
  });
});
