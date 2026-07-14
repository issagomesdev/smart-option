import { Router } from "express";
import { paymentService } from "../../../payments/payment.service";
import { ASAAS_WEBHOOK_JOB_NAME, asaasWebhookQueue } from "../../../infrastructure/queue/queues/asaas-webhook.queue";
import { ok } from "../../../shared/http/response";

export const asaasWebhookRouter = Router();

/**
 * Endpoint único de webhook da Asaas — recebe eventos de pagamento e de
 * transferência no mesmo lugar (`event` no payload diferencia os dois).
 * Só valida a assinatura e grava a captura bruta antes de responder — o
 * processamento de fato (idempotência, crédito, ativação de plano) roda
 * assíncrono no worker (`asaas-webhook.worker.ts`), para responder rápido
 * mesmo se o banco estiver momentaneamente lento. A Asaas reenvia em retry
 * se não receber 2xx rapidamente.
 */
asaasWebhookRouter.post("/", async (req, res, next) => {
  try {
    const { webhookLogId, event } = await paymentService.receiveWebhook(req.header("asaas-access-token"), req.body);
    // O BullMQ deduplica por jobId: se já existe um job para este evento (de
    // uma entrega anterior), `add()` reaproveita o job existente em vez de
    // enfileirar de novo — o que significa que esta captura específica em
    // `webhook_logs` nunca vai passar pelo worker. Marcamos como duplicada
    // aqui mesmo, em vez de deixá-la presa em "received" para sempre.
    const existingJob = await asaasWebhookQueue.getJob(event.externalEventId);
    if (existingJob) {
      await paymentService.markWebhookDuplicate(webhookLogId);
      ok(res, { received: true, duplicate: true });
      return;
    }

    await asaasWebhookQueue.add(
      ASAAS_WEBHOOK_JOB_NAME,
      { webhookLogId, rawPayload: req.body },
      { jobId: event.externalEventId },
    );

    ok(res, { received: true, duplicate: false });
  } catch (error) {
    next(error);
  }
});
