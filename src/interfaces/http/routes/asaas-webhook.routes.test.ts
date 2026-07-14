import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../payments/payment.service", () => ({
  paymentService: { receiveWebhook: vi.fn(), markWebhookDuplicate: vi.fn() },
}));
vi.mock("../../../infrastructure/queue/queues/asaas-webhook.queue", () => ({
  ASAAS_WEBHOOK_JOB_NAME: "process",
  asaasWebhookQueue: { add: vi.fn(), getJob: vi.fn() },
}));

import { paymentService } from "../../../payments/payment.service";
import { asaasWebhookQueue } from "../../../infrastructure/queue/queues/asaas-webhook.queue";
import { UnauthorizedError } from "../../../shared/errors";
import { errorHandler } from "../../../infrastructure/http/middlewares/error-handler";
import { asaasWebhookRouter } from "./asaas-webhook.routes";

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    // @ts-expect-error simplificação do pino-http real, só o suficiente para o error handler funcionar no teste
    req.log = { error: vi.fn(), warn: vi.fn() };
    req.id = "test-request-id";
    next();
  });
  app.use("/api/webhooks/asaas", asaasWebhookRouter);
  app.use(errorHandler);
  return app;
}

describe("POST /api/webhooks/asaas", () => {
  const fakeEvent = {
    externalEventId: "evt_1",
    eventType: "PAYMENT_RECEIVED",
    category: "payment" as const,
    resourceExternalId: "pay_1",
    status: "RECEIVED",
    raw: {},
  };

  beforeEach(() => {
    vi.mocked(paymentService.receiveWebhook).mockReset();
    vi.mocked(paymentService.markWebhookDuplicate).mockReset();
    vi.mocked(asaasWebhookQueue.add).mockReset();
    vi.mocked(asaasWebhookQueue.getJob).mockReset();
  });

  it("enfileira o job com o externalEventId como jobId quando não há job existente", async () => {
    vi.mocked(paymentService.receiveWebhook).mockResolvedValue({ webhookLogId: 42, event: fakeEvent });
    vi.mocked(asaasWebhookQueue.getJob).mockResolvedValue(undefined);

    const payload = { event: "PAYMENT_RECEIVED", payment: { id: "pay_1", status: "RECEIVED" } };

    const response = await request(buildApp())
      .post("/api/webhooks/asaas")
      .set("asaas-access-token", "valid-token")
      .send(payload);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ success: true, data: { received: true, duplicate: false } });
    expect(asaasWebhookQueue.add).toHaveBeenCalledWith(
      "process",
      { webhookLogId: 42, rawPayload: payload },
      { jobId: "evt_1" },
    );
  });

  it("não enfileira de novo e marca a captura como duplicada quando o job já existe", async () => {
    vi.mocked(paymentService.receiveWebhook).mockResolvedValue({ webhookLogId: 43, event: fakeEvent });
    vi.mocked(asaasWebhookQueue.getJob).mockResolvedValue({ id: "evt_1" } as never);

    const response = await request(buildApp())
      .post("/api/webhooks/asaas")
      .set("asaas-access-token", "valid-token")
      .send({ event: "PAYMENT_RECEIVED", payment: { id: "pay_1", status: "RECEIVED" } });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ success: true, data: { received: true, duplicate: true } });
    expect(asaasWebhookQueue.add).not.toHaveBeenCalled();
    expect(paymentService.markWebhookDuplicate).toHaveBeenCalledWith(43);
  });

  it("responde 401 e não enfileira nada quando a assinatura é inválida", async () => {
    vi.mocked(paymentService.receiveWebhook).mockRejectedValue(new UnauthorizedError("Assinatura inválida"));

    const response = await request(buildApp()).post("/api/webhooks/asaas").send({ event: "PAYMENT_RECEIVED" });

    expect(response.status).toBe(401);
    expect(asaasWebhookQueue.add).not.toHaveBeenCalled();
  });
});
