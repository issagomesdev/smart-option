import { describe, expect, it } from "vitest";
import { isValidCpf, normalizeCpf } from "./cpf";

describe("isValidCpf", () => {
  it("aceita um CPF válido (dígito verificador correto)", () => {
    expect(isValidCpf("52998224725")).toBe(true);
  });

  it("aceita um CPF válido formatado", () => {
    expect(isValidCpf("529.982.247-25")).toBe(true);
  });

  it("rejeita dígito verificador incorreto", () => {
    expect(isValidCpf("52998224726")).toBe(false);
  });

  it("rejeita sequências de dígitos repetidos", () => {
    expect(isValidCpf("11111111111")).toBe(false);
  });

  it("rejeita tamanho incorreto", () => {
    expect(isValidCpf("123456789")).toBe(false);
    expect(isValidCpf("123456789012")).toBe(false);
  });
});

describe("normalizeCpf", () => {
  it("remove máscara e mantém só dígitos", () => {
    expect(normalizeCpf("529.982.247-25")).toBe("52998224725");
  });
});
