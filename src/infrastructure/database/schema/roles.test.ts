import { asc, eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { db } from "../client";
import { roles, staffUsers } from "./index";

/**
 * Prova que a migration da Fase 5 parte 3 (`0003_tan_carmella_unuscione`)
 * deixou o banco no estado esperado — não testa a migration em si (roda uma
 * vez, já aplicada), mas o resultado dela, para pegar uma regressão se
 * alguém editar o seed por engano numa migration futura ou resetar o banco
 * de dev com uma versão desatualizada do arquivo.
 */
describe("roles (seed da migration, banco real)", () => {
  it("semeia exatamente 2 papéis de sistema: admin (id 1, todas as 6 permissões) e staff (id 2, nenhuma)", async () => {
    const rows = await db.select().from(roles).orderBy(asc(roles.id));

    expect(rows).toHaveLength(2);

    expect(rows[0]).toMatchObject({
      id: 1,
      name: "admin",
      isSystem: true,
      permissions: ["users.write", "finance.adjust", "withdrawals.approve", "support.write", "staff.manage", "roles.manage"],
    });

    expect(rows[1]).toMatchObject({ id: 2, name: "staff", isSystem: true, permissions: [] });
  });

  it("staff_users.role_id tem FK de verdade para roles.id (staff já semeado aponta para 'admin')", async () => {
    const [seededAdmin] = await db.select({ roleId: staffUsers.roleId }).from(staffUsers).where(eq(staffUsers.email, "admin@admin.com"));

    expect(seededAdmin.roleId).toBe(1);
  });
});
