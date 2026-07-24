import { describe, expect, it } from "vitest";
import { requestsUserIdParamDto, resWithdrawalDto, transfValuesAdminDto, updateBotUserDto } from "./admin.dto";

describe("resWithdrawalDto", () => {
  it("aceita o corpo completo (res, id, observation) — o formato que o service sempre esperou", () => {
    const result = resWithdrawalDto.safeParse({ res: true, id: 7, observation: "aprovado" });
    expect(result.success).toBe(true);
  });

  it("rejeita quando falta o id — o bug corrigido era enviar só o booleano `res`", () => {
    const result = resWithdrawalDto.safeParse(true);
    expect(result.success).toBe(false);
  });

  it("observation é opcional", () => {
    const result = resWithdrawalDto.safeParse({ res: false, id: 7 });
    expect(result.success).toBe(true);
  });
});

describe("transfValuesAdminDto", () => {
  it("aceita type sum/subtract e rejeita qualquer outro valor", () => {
    expect(transfValuesAdminDto.safeParse({ user_id: 1, value: "10.00", type: "sum" }).success).toBe(true);
    expect(transfValuesAdminDto.safeParse({ user_id: 1, value: "10.00", type: "subtract" }).success).toBe(true);
    expect(transfValuesAdminDto.safeParse({ user_id: 1, value: "10.00", type: "delete_everything" }).success).toBe(false);
  });

  it("rejeita valor monetário em formato inválido", () => {
    expect(transfValuesAdminDto.safeParse({ user_id: 1, value: "abc", type: "sum" }).success).toBe(false);
  });
});

/**
 * Regressão: o painel administrativo pede a fila global de solicitações
 * (todos os usuários) chamando `/api/requests/withdrawal/all` — o literal
 * `"all"` no lugar de um id real. `z.coerce.number()` sozinho vira `NaN` e
 * falha em `.positive()`, então essa validação rejeitava a rota inteira com
 * 400 antes mesmo do route handler (que já sabia converter `"all"` para
 * `null`) rodar. Reproduzido ao vivo pelo painel (tela `/requests`) antes
 * desta correção.
 */
describe("requestsUserIdParamDto", () => {
  it('aceita o literal "all" (fila global de solicitações)', () => {
    expect(requestsUserIdParamDto.safeParse({ id: "all" }).success).toBe(true);
  });

  it("aceita um id numérico válido (fila de um usuário específico)", () => {
    const result = requestsUserIdParamDto.safeParse({ id: "42" });
    expect(result.success).toBe(true);
    expect(result.success && result.data.id).toBe(42);
  });

  it("rejeita valores que não são nem número nem o literal all", () => {
    expect(requestsUserIdParamDto.safeParse({ id: "abc" }).success).toBe(false);
    expect(requestsUserIdParamDto.safeParse({ id: "-1" }).success).toBe(false);
  });
});

describe("updateBotUserDto", () => {
  it("password é opcional (nem toda atualização troca a senha)", () => {
    const result = updateBotUserDto.safeParse({
      id: 1,
      name: "Cliente",
      email: "cliente@example.com",
      phone_number: "11999999999",
      adress: "Rua X",
      pix_code: "cliente@example.com",
    });
    expect(result.success).toBe(true);
  });

  it("rejeita e-mail inválido", () => {
    const result = updateBotUserDto.safeParse({
      id: 1,
      name: "Cliente",
      email: "not-an-email",
      phone_number: "11999999999",
      adress: "Rua X",
      pix_code: "x",
    });
    expect(result.success).toBe(false);
  });
});
