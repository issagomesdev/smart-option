import { describe, expect, it } from "vitest";
import { inferPixKeyType } from "./pix-key";

describe("inferPixKeyType", () => {
  it("identifica e-mail", () => {
    expect(inferPixKeyType("cliente@example.com")).toBe("EMAIL");
  });

  it("identifica chave aleatória (EVP)", () => {
    expect(inferPixKeyType("a1b2c3d4-e5f6-7890-abcd-ef1234567890")).toBe("EVP");
  });

  it("identifica CNPJ (14 dígitos)", () => {
    expect(inferPixKeyType("11222333000181")).toBe("CNPJ");
  });

  it("identifica CNPJ formatado com máscara", () => {
    expect(inferPixKeyType("11.222.333/0001-81")).toBe("CNPJ");
  });

  it("identifica CPF válido (11 dígitos com dígito verificador correto)", () => {
    // CPF válido conhecido usado em testes (algoritmo mod 11 bate).
    expect(inferPixKeyType("52998224725")).toBe("CPF");
  });

  it("trata 11 dígitos com dígito verificador inválido como telefone, não CPF", () => {
    // Mesmo tamanho de um CPF, mas o dígito verificador não fecha —
    // é exatamente o caso ambíguo que a validação de checksum resolve.
    expect(inferPixKeyType("11987654321")).toBe("PHONE");
  });

  it("identifica telefone com 10 dígitos (fixo, DDD + 8 dígitos)", () => {
    expect(inferPixKeyType("1122223333")).toBe("PHONE");
  });

  it("rejeita CPF com todos os dígitos iguais", () => {
    expect(() => inferPixKeyType("11111111111")).not.toThrow();
    expect(inferPixKeyType("11111111111")).toBe("PHONE");
  });

  it("lança erro para chave em formato não reconhecido", () => {
    expect(() => inferPixKeyType("abc")).toThrow(/Não foi possível identificar/);
  });
});
