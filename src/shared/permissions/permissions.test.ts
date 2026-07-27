import { describe, expect, it } from "vitest";
import { assertCanGrant, assertStaffManageSurvives, isPermission, PERMISSIONS } from "./permissions";

describe("PERMISSIONS / isPermission", () => {
  it("tem exatamente as 7 chaves esperadas", () => {
    expect(PERMISSIONS).toEqual([
      "users.write",
      "finance.adjust",
      "withdrawals.approve",
      "support.write",
      "staff.manage",
      "roles.manage",
      "plans.manage",
    ]);
  });

  it("isPermission aceita só valores do catálogo", () => {
    expect(isPermission("users.write")).toBe(true);
    expect(isPermission("nao-existe")).toBe(false);
  });
});

describe("assertCanGrant", () => {
  it("não lança quando o ator possui todas as permissões que está concedendo", () => {
    expect(() => assertCanGrant(["users.write", "staff.manage"], ["users.write"])).not.toThrow();
  });

  it("lança ForbiddenError quando o ator tenta conceder uma permissão que não possui", () => {
    expect(() => assertCanGrant(["roles.manage"], ["staff.manage"])).toThrow(
      "Você não pode conceder permissões que não possui: staff.manage",
    );
  });

  it("lista todas as permissões não concedíveis na mensagem, não só a primeira", () => {
    expect(() => assertCanGrant([], ["users.write", "finance.adjust"])).toThrow(
      "Você não pode conceder permissões que não possui: users.write, finance.adjust",
    );
  });

  it("array de permissões alvo vazio nunca lança, mesmo com ator sem nenhuma permissão", () => {
    expect(() => assertCanGrant([], [])).not.toThrow();
  });
});

describe("assertStaffManageSurvives", () => {
  it("não lança quando pelo menos 1 staff ativo ficaria com staff.manage", () => {
    expect(() => assertStaffManageSurvives(1)).not.toThrow();
    expect(() => assertStaffManageSurvives(5)).not.toThrow();
  });

  it("lança ConflictError quando a contagem cairia a zero", () => {
    expect(() => assertStaffManageSurvives(0)).toThrow(
      "Essa ação deixaria o sistema sem nenhum staff com permissão para gerenciar a equipe.",
    );
  });
});
