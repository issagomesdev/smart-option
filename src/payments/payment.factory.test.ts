import { describe, expect, it } from "vitest";
import { getPaymentProvider } from "./payment.factory";
import { AsaasProvider } from "./providers/asaas/asaas-provider";

describe("getPaymentProvider", () => {
  it("retorna uma instância de AsaasProvider", () => {
    expect(getPaymentProvider()).toBeInstanceOf(AsaasProvider);
  });

  it("retorna sempre a mesma instância (singleton)", () => {
    expect(getPaymentProvider()).toBe(getPaymentProvider());
  });
});
