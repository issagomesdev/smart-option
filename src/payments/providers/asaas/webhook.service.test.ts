import { describe, expect, it } from "vitest";
import { AsaasWebhookService } from "./webhook.service";

describe("AsaasWebhookService", () => {
  describe("verifySignature", () => {
    it("aceita quando o header bate com ASAAS_WEBHOOK_TOKEN", () => {
      const service = new AsaasWebhookService();
      expect(service.verifySignature("test-asaas-webhook-token")).toBe(true);
    });

    it("rejeita quando o header não bate", () => {
      const service = new AsaasWebhookService();
      expect(service.verifySignature("token-errado")).toBe(false);
    });

    it("rejeita quando o header está ausente", () => {
      const service = new AsaasWebhookService();
      expect(service.verifySignature(undefined)).toBe(false);
    });

    it("rejeita com tamanho diferente sem lançar exceção", () => {
      const service = new AsaasWebhookService();
      expect(service.verifySignature("x")).toBe(false);
    });
  });

  describe("parseWebhookEvent", () => {
    it("reconhece evento de pagamento e usa o id do payload como externalEventId", () => {
      const service = new AsaasWebhookService();
      const payload = {
        id: "evt_123",
        event: "PAYMENT_RECEIVED",
        payment: { id: "pay_456", status: "RECEIVED" },
      };

      const result = service.parseWebhookEvent(payload);

      expect(result).toMatchObject({
        externalEventId: "evt_123",
        eventType: "PAYMENT_RECEIVED",
        category: "payment",
        resourceExternalId: "pay_456",
        status: "RECEIVED",
      });
    });

    it("reconhece evento de transferência", () => {
      const service = new AsaasWebhookService();
      const payload = { event: "TRANSFER_DONE", transfer: { id: "tra_789", status: "DONE" } };

      const result = service.parseWebhookEvent(payload);

      expect(result.category).toBe("transfer");
      expect(result.resourceExternalId).toBe("tra_789");
    });

    it("deriva externalEventId determinístico quando o payload não traz id", () => {
      const service = new AsaasWebhookService();
      const payload = { event: "PAYMENT_CONFIRMED", payment: { id: "pay_1", status: "CONFIRMED" } };

      const result = service.parseWebhookEvent(payload);

      expect(result.externalEventId).toBe("PAYMENT_CONFIRMED:pay_1:CONFIRMED");
    });

    it("marca categoria unknown quando não há payment nem transfer", () => {
      const service = new AsaasWebhookService();
      const result = service.parseWebhookEvent({ event: "SOME_OTHER_EVENT" });

      expect(result.category).toBe("unknown");
      expect(result.resourceExternalId).toBeNull();
    });

    it("lança ValidationError para payload sem o campo event", () => {
      const service = new AsaasWebhookService();
      expect(() => service.parseWebhookEvent({ foo: "bar" })).toThrow();
    });
  });
});
