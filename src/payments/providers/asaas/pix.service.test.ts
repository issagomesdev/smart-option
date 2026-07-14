import { describe, expect, it, vi } from "vitest";

vi.mock("./http-client", () => ({
  asaasHttpClient: { get: vi.fn() },
}));

import { asaasHttpClient } from "./http-client";
import { AsaasPixService } from "./pix.service";

describe("AsaasPixService", () => {
  it("busca o QR Code de um pagamento pelo id", async () => {
    vi.mocked(asaasHttpClient.get).mockResolvedValue({
      data: { encodedImage: "base64img", payload: "00020126...", expirationDate: "2026-01-01T12:00:00Z" },
    });

    const service = new AsaasPixService();
    const result = await service.getQrCode("pay_1");

    expect(asaasHttpClient.get).toHaveBeenCalledWith("/payments/pay_1/pixQrCode");
    expect(result.encodedImage).toBe("base64img");
    expect(result.payload).toBe("00020126...");
  });
});
