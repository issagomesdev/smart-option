import { describe, expect, it, vi } from "vitest";

vi.mock("./http-client", () => ({
  asaasHttpClient: { post: vi.fn() },
}));

import { asaasHttpClient } from "./http-client";
import { AsaasTransferService } from "./transfer.service";

describe("AsaasTransferService", () => {
  it("infere o tipo da chave PIX e envia para a Asaas", async () => {
    vi.mocked(asaasHttpClient.post).mockResolvedValue({ data: { id: "tra_1", status: "PENDING" } });

    const service = new AsaasTransferService();
    const result = await service.createPixTransfer({
      amount: 50,
      pixKey: "cliente@example.com",
      description: "Saque #1",
      externalReference: "withdrawal-1",
    });

    expect(result).toEqual({ id: "tra_1", status: "PENDING" });
    expect(asaasHttpClient.post).toHaveBeenCalledWith("/transfers", {
      value: 50,
      pixAddressKey: "cliente@example.com",
      pixAddressKeyType: "EMAIL",
      description: "Saque #1",
      externalReference: "withdrawal-1",
    });
  });
});
