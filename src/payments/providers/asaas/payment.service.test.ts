import { describe, expect, it, vi } from "vitest";

vi.mock("./http-client", () => ({
  asaasHttpClient: { post: vi.fn() },
}));

import { asaasHttpClient } from "./http-client";
import { AsaasPaymentService } from "./payment.service";

describe("AsaasPaymentService", () => {
  it("cria uma cobrança PIX com dueDate no formato YYYY-MM-DD", async () => {
    vi.mocked(asaasHttpClient.post).mockResolvedValue({ data: { id: "pay_1", status: "PENDING" } });

    const service = new AsaasPaymentService();
    const result = await service.createPixPayment({
      customerExternalId: "cus_1",
      amount: 100,
      description: "Depósito",
      externalReference: "checkout-1",
    });

    expect(result).toEqual({ id: "pay_1", status: "PENDING" });

    const [, body] = vi.mocked(asaasHttpClient.post).mock.calls[0] as [string, Record<string, unknown>];
    expect(body).toMatchObject({
      customer: "cus_1",
      billingType: "PIX",
      value: 100,
      description: "Depósito",
      externalReference: "checkout-1",
    });
    expect(body.dueDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
