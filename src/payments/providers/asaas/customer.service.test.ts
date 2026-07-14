import { describe, expect, it, vi } from "vitest";

vi.mock("./http-client", () => ({
  asaasHttpClient: { post: vi.fn() },
}));

import { asaasHttpClient } from "./http-client";
import { AsaasCustomerService } from "./customer.service";
import { ExternalServiceError } from "../../../shared/errors";

describe("AsaasCustomerService", () => {
  it("cria o customer e envia apenas os campos presentes", async () => {
    vi.mocked(asaasHttpClient.post).mockResolvedValue({ data: { id: "cus_123" } });

    const service = new AsaasCustomerService();
    const result = await service.createCustomer({
      name: "Cliente Teste",
      email: "cliente@example.com",
      externalReference: "42",
    });

    expect(result).toEqual({ externalCustomerId: "cus_123" });
    expect(asaasHttpClient.post).toHaveBeenCalledWith("/customers", {
      name: "Cliente Teste",
      email: "cliente@example.com",
      externalReference: "42",
    });
  });

  it("inclui cpfCnpj e telefone quando informados", async () => {
    vi.mocked(asaasHttpClient.post).mockResolvedValue({ data: { id: "cus_456" } });

    const service = new AsaasCustomerService();
    await service.createCustomer({
      name: "Cliente Com CPF",
      email: "cliente2@example.com",
      cpfCnpj: "52998224725",
      phone: "11987654321",
      externalReference: "43",
    });

    expect(asaasHttpClient.post).toHaveBeenCalledWith(
      "/customers",
      expect.objectContaining({ cpfCnpj: "52998224725", mobilePhone: "11987654321" }),
    );
  });

  it("traduz falha HTTP em ExternalServiceError", async () => {
    vi.mocked(asaasHttpClient.post).mockRejectedValue(new Error("network down"));

    const service = new AsaasCustomerService();

    await expect(
      service.createCustomer({ name: "X", email: "x@x.com", externalReference: "1" }),
    ).rejects.toBeInstanceOf(ExternalServiceError);
  });
});
