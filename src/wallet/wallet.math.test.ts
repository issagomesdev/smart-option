import { describe, expect, it } from "vitest";
import { applyDirection, fromCents, toCents } from "./wallet.math";

describe("wallet.math", () => {
  it("toCents/fromCents fazem o round-trip sem erro de ponto flutuante", () => {
    expect(toCents("0.10")).toBe(10);
    expect(toCents("0.20")).toBe(20);
    expect(fromCents(toCents("0.10") + toCents("0.20"))).toBe("0.30");
  });

  it("applyDirection soma no crédito e subtrai no débito", () => {
    expect(applyDirection(1000, 250, "credit")).toBe(1250);
    expect(applyDirection(1000, 250, "debit")).toBe(750);
  });

  it("applyDirection permite saldo negativo (quem decide se é aceitável é a camada acima)", () => {
    expect(applyDirection(100, 250, "debit")).toBe(-150);
  });
});
