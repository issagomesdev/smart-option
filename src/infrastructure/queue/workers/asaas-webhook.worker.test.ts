import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../payments/payment.service", () => ({
  paymentService: { processWebhookEvent: vi.fn(), markWebhookFailed: vi.fn() },
}));
vi.mock("../../../payments/webhook-legacy-bridge", () => ({
  bridgeToLegacyCascade: vi.fn(),
}));
vi.mock("../../../payments/payment.factory", () => ({
  getPaymentProvider: vi.fn(() => ({ parseWebhookEvent: vi.fn(() => parsedEvent) })),
}));

import { paymentService } from "../../../payments/payment.service";
import { bridgeToLegacyCascade } from "../../../payments/webhook-legacy-bridge";
import { processJob } from "./asaas-webhook.worker";

const parsedEvent = {
  externalEventId: "evt_1",
  eventType: "PAYMENT_RECEIVED",
  category: "payment" as const,
  resourceExternalId: "pay_1",
  status: "RECEIVED",
  raw: {},
};

function fakeJob(data: { webhookLogId: number; rawPayload: unknown }) {
  return { data } as never;
}

describe("processJob (worker de webhooks Asaas)", () => {
  beforeEach(() => {
    vi.mocked(paymentService.processWebhookEvent).mockReset();
    vi.mocked(bridgeToLegacyCascade).mockReset();
  });

  it("processa o evento e aciona a cascata legada quando não é duplicado", async () => {
    const paymentTransaction = { id: 1, status: "confirmed", metadata: { legacyCheckoutId: "9" } } as never;
    vi.mocked(paymentService.processWebhookEvent).mockResolvedValue({ duplicate: false, paymentTransaction });

    await processJob(fakeJob({ webhookLogId: 5, rawPayload: { event: "PAYMENT_RECEIVED" } }));

    expect(paymentService.processWebhookEvent).toHaveBeenCalledWith(5, parsedEvent, { event: "PAYMENT_RECEIVED" });
    expect(bridgeToLegacyCascade).toHaveBeenCalledWith(parsedEvent, paymentTransaction);
  });

  it("não aciona a cascata legada quando o evento é duplicado", async () => {
    vi.mocked(paymentService.processWebhookEvent).mockResolvedValue({ duplicate: true, paymentTransaction: null });

    await processJob(fakeJob({ webhookLogId: 6, rawPayload: {} }));

    expect(bridgeToLegacyCascade).not.toHaveBeenCalled();
  });

  it("não aciona a cascata legada quando não há payment_transaction correspondente", async () => {
    vi.mocked(paymentService.processWebhookEvent).mockResolvedValue({ duplicate: false, paymentTransaction: null });

    await processJob(fakeJob({ webhookLogId: 7, rawPayload: {} }));

    expect(bridgeToLegacyCascade).not.toHaveBeenCalled();
  });
});
