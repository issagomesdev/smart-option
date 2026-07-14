import { describe, expect, it, vi } from "vitest";
import { AsaasProvider } from "./asaas-provider";

function buildProvider() {
  const customerService = { createCustomer: vi.fn() };
  const paymentService = { createPixPayment: vi.fn() };
  const pixService = { getQrCode: vi.fn() };
  const transferService = { createPixTransfer: vi.fn() };
  const webhookService = { verifySignature: vi.fn(), parseWebhookEvent: vi.fn() };
  const notificationService = { disableCustomerNotifications: vi.fn() };

  const provider = new AsaasProvider(
    customerService as any,
    paymentService as any,
    pixService as any,
    transferService as any,
    webhookService as any,
    notificationService as any,
  );

  return { provider, customerService, paymentService, pixService, transferService, webhookService, notificationService };
}

describe("AsaasProvider", () => {
  it("createCustomer cria o customer e desativa notificações automáticas da Asaas", async () => {
    const { provider, customerService, notificationService } = buildProvider();
    customerService.createCustomer.mockResolvedValue({ externalCustomerId: "cus_1" });

    const result = await provider.createCustomer({ name: "A", email: "a@a.com", externalReference: "1" });

    expect(result).toEqual({ externalCustomerId: "cus_1" });
    expect(notificationService.disableCustomerNotifications).toHaveBeenCalledWith("cus_1");
  });

  it("createPixCharge combina payment + pix QR code", async () => {
    const { provider, paymentService, pixService } = buildProvider();
    paymentService.createPixPayment.mockResolvedValue({ id: "pay_1", status: "PENDING" });
    pixService.getQrCode.mockResolvedValue({
      encodedImage: "img",
      payload: "copia-e-cola",
      expirationDate: "2026-01-01T00:00:00Z",
    });

    const result = await provider.createPixCharge({
      customerExternalId: "cus_1",
      amount: 10,
      description: "d",
      externalReference: "ref",
    });

    expect(pixService.getQrCode).toHaveBeenCalledWith("pay_1");
    expect(result).toEqual({
      externalId: "pay_1",
      status: "PENDING",
      qrCodeImageBase64: "img",
      qrCodePayload: "copia-e-cola",
      expiresAt: new Date("2026-01-01T00:00:00Z"),
    });
  });

  it("createTransfer delega ao transferService", async () => {
    const { provider, transferService } = buildProvider();
    transferService.createPixTransfer.mockResolvedValue({ id: "tra_1", status: "PENDING" });

    const result = await provider.createTransfer({
      amount: 20,
      pixKey: "a@a.com",
      description: "d",
      externalReference: "ref",
    });

    expect(result).toEqual({ externalId: "tra_1", status: "PENDING" });
  });

  it("verifyWebhookSignature e parseWebhookEvent delegam ao webhookService", () => {
    const { provider, webhookService } = buildProvider();
    webhookService.verifySignature.mockReturnValue(true);
    webhookService.parseWebhookEvent.mockReturnValue({ eventType: "X" });

    expect(provider.verifyWebhookSignature("token")).toBe(true);
    expect(provider.parseWebhookEvent({})).toEqual({ eventType: "X" });
  });
});
