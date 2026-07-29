import { and, eq, inArray } from "drizzle-orm";
import { afterEach, describe, expect, it } from "vitest";
import { db } from "../infrastructure/database/client";
import { auditLogs, roles, staffRefreshTokens, staffUsers } from "../infrastructure/database/schema";
import type { Permission } from "../shared/permissions/permissions";
import { PROTECTED_STAFF_ID, StaffService } from "./staff.service";

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
  const createdAuditIds: number[] = [];
  const stamp = Date.now();
  let counter = 0;

  afterEach(async () => {
    if (createdStaffIds.length) {
      // Antes de apagar os staff: toda linha de auditoria gerada por eles, mesmo a que o teste não
      // leu de volta. Sem isso a trilha do ambiente de dev acumula ruído de teste a cada execução.
      await db
        .delete(auditLogs)
        .where(and(eq(auditLogs.entityType, "staff_users"), inArray(auditLogs.entityId, createdStaffIds.map(String))));
      await db.delete(staffUsers).where(inArray(staffUsers.id, createdStaffIds));
      createdStaffIds.length = 0;
    }
    if (createdAuditIds.length) {
      await db.delete(auditLogs).where(inArray(auditLogs.id, createdAuditIds));
      createdAuditIds.length = 0;
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

  describe("update", () => {
    it("atualiza nome, sobrenome e e-mail sem exigir senha", async () => {
      const roleId = await insertTestRole(["support.write"]);
      const staffId = await insertTestStaff(roleId);
      const email = `staff-update-${stamp}@test.local`;

      const updated = await StaffService.update(
        staffId,
        { name: "Nome Novo", surname: "Sobrenome Novo", email },
        { id: 1, email: "editor@test.local" },
      );

      expect(updated).toMatchObject({ id: staffId, name: "Nome Novo", surname: "Sobrenome Novo", email });
    });

    it("sem senha no payload, mantém o hash atual intacto", async () => {
      const roleId = await insertTestRole([]);
      const staffId = await insertTestStaff(roleId);
      const [{ password: before }] = await db
        .select({ password: staffUsers.password })
        .from(staffUsers)
        .where(eq(staffUsers.id, staffId));

      await StaffService.update(staffId, { name: "A", surname: "B", email: `staff-sem-senha-${stamp}@test.local` }, null);

      const [{ password: after }] = await db
        .select({ password: staffUsers.password })
        .from(staffUsers)
        .where(eq(staffUsers.id, staffId));
      expect(after).toBe(before);
    });

    it("com senha no payload, grava um hash bcrypt novo (nunca o texto puro)", async () => {
      const roleId = await insertTestRole([]);
      const staffId = await insertTestStaff(roleId);

      await StaffService.update(
        staffId,
        { name: "A", surname: "B", email: `staff-com-senha-${stamp}@test.local`, password: "senha-forte-123" },
        null,
      );

      const [{ password }] = await db
        .select({ password: staffUsers.password })
        .from(staffUsers)
        .where(eq(staffUsers.id, staffId));
      expect(password).not.toBe("senha-forte-123");
      expect(password.startsWith("$2")).toBe(true);
    });

    // Qualquer portador de `staff.manage` pode editar qualquer membro da equipe — incluindo quem
    // tem mais permissões. A contenção dessa decisão é a trilha de auditoria abaixo.
    it("permite editar um staff que possui permissões que o ator não tem", async () => {
      const targetRoleId = await insertTestRole(["withdrawals.approve", "finance.adjust"]);
      const staffId = await insertTestStaff(targetRoleId);

      const updated = await StaffService.update(
        staffId,
        { name: "Editado", surname: "Por Outro", email: `staff-sem-filtro-${stamp}@test.local`, password: "senha-forte-123" },
        { id: 1, email: "quem-editou@test.local" },
      );

      expect(updated.name).toBe("Editado");
    });

    it("registra a edição em audit_logs com antes/depois, sem guardar a senha", async () => {
      const roleId = await insertTestRole([]);
      const staffId = await insertTestStaff(roleId);
      const [{ name: nomeAntes }] = await db
        .select({ name: staffUsers.name })
        .from(staffUsers)
        .where(eq(staffUsers.id, staffId));

      await StaffService.update(
        staffId,
        { name: "Depois", surname: "Auditado", email: `staff-auditado-${stamp}@test.local`, password: "senha-secreta-123" },
        { id: 1, email: "auditor@test.local" },
      );

      const [entry] = await db
        .select()
        .from(auditLogs)
        .where(and(eq(auditLogs.entityType, "staff_users"), eq(auditLogs.entityId, String(staffId))));
      createdAuditIds.push(entry.id);

      expect(entry.action).toBe("staff.updated");
      expect(entry.actorId).toBe(1);
      expect(entry.before).toMatchObject({ name: nomeAntes });
      expect(entry.after).toMatchObject({ name: "Depois", passwordChanged: true, actorEmail: "auditor@test.local" });
      // A senha nunca pode aparecer na trilha — nem em texto puro, nem como hash.
      expect(JSON.stringify(entry)).not.toContain("senha-secreta-123");
      expect(JSON.stringify(entry)).not.toContain("$2");
    });

    it("recusa e-mail já usado por outro staff", async () => {
      const roleId = await insertTestRole([]);
      const firstId = await insertTestStaff(roleId, "Primeiro");
      const secondId = await insertTestStaff(roleId, "Segundo");

      const [{ email: emailDoPrimeiro }] = await db
        .select({ email: staffUsers.email })
        .from(staffUsers)
        .where(eq(staffUsers.id, firstId));

      await expect(
        StaffService.update(secondId, { name: "A", surname: "B", email: emailDoPrimeiro }, null),
      ).rejects.toThrow(/Já existe um staff com esse e-mail/i);
    });

    it("staff inexistente devolve NotFound", async () => {
      await expect(
        StaffService.update(999999999, { name: "A", surname: "B", email: `staff-inexistente-${stamp}@test.local` }, null),
      ).rejects.toThrow("Staff inexistente");
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

  describe("remove", () => {
    it("exclui o staff de verdade — a linha some do banco", async () => {
      const roleId = await insertTestRole([]);
      const staffId = await insertTestStaff(roleId);

      const result = await StaffService.remove(staffId, 999999999);
      expect(result.status).toBe(true);

      const rows = await db.select().from(staffUsers).where(eq(staffUsers.id, staffId));
      expect(rows).toHaveLength(0);
    });

    it("apaga junto as sessões do staff — a FK de staff_refresh_tokens não tem ON DELETE CASCADE", async () => {
      const roleId = await insertTestRole([]);
      const staffId = await insertTestStaff(roleId);

      await db.insert(staffRefreshTokens).values({
        staffUserId: staffId,
        tokenHash: `staff-remove-test-${stamp}-${(counter += 1)}`,
        expiresAt: new Date(Date.now() + 60_000),
      });

      await StaffService.remove(staffId, 999999999);

      const tokens = await db.select().from(staffRefreshTokens).where(eq(staffRefreshTokens.staffUserId, staffId));
      expect(tokens).toHaveLength(0);
    });

    it("registra a exclusão na trilha, com o estado anterior preservado", async () => {
      const roleId = await insertTestRole([]);
      const staffId = await insertTestStaff(roleId, "Excluido");

      await StaffService.remove(staffId, 999999999, { id: 1, email: "auditor@test.local" });

      const [entry] = await db
        .select()
        .from(auditLogs)
        .where(and(eq(auditLogs.entityType, "staff_users"), eq(auditLogs.entityId, String(staffId))));
      createdAuditIds.push(entry.id);

      expect(entry.action).toBe("staff.deleted");
      expect(entry.before).toMatchObject({ name: "Excluido" });
      // A linha do staff já não existe: a trilha só sobrevive porque `actor_id` não tem FK e o
      // e-mail do autor é desnormalizado dentro de `after`.
      expect(entry.after).toMatchObject({ actorEmail: "auditor@test.local" });
    });

    it("recusa excluir o administrador principal (id 1) incondicionalmente", async () => {
      await expect(StaffService.remove(PROTECTED_STAFF_ID, 999999999)).rejects.toThrow(
        "O administrador principal não pode ser excluído",
      );

      // O guard vem antes de qualquer escrita: a conta continua lá.
      const rows = await db.select().from(staffUsers).where(eq(staffUsers.id, PROTECTED_STAFF_ID));
      expect(rows).toHaveLength(1);
    });

    it("recusa auto-exclusão incondicionalmente", async () => {
      const roleId = await insertTestRole([]);
      const staffId = await insertTestStaff(roleId);

      await expect(StaffService.remove(staffId, staffId)).rejects.toThrow("Você não pode excluir a própria conta");
    });

    it("permite excluir um staff com staff.manage quando outro staff ativo ainda o possui por outro papel", async () => {
      const holderRoleId = await insertTestRole(["staff.manage"]);
      await insertTestStaff(holderRoleId);

      const staffManageRoleId = await insertTestRole(["staff.manage"]);
      const targetStaffId = await insertTestStaff(staffManageRoleId);

      const result = await StaffService.remove(targetStaffId, 999999999);
      expect(result.status).toBe(true);
    });

    it("lança NotFoundError para staff inexistente", async () => {
      await expect(StaffService.remove(999999999, 888888888)).rejects.toThrow("Staff inexistente");
    });
  });
});
