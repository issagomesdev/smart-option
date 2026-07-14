import { Queue } from "bullmq";
import { queueConnection } from "../connection";

export const ASAAS_WEBHOOK_QUEUE_NAME = "asaas-webhooks";
export const ASAAS_WEBHOOK_JOB_NAME = "process" as const;

export interface AsaasWebhookJobData {
  webhookLogId: number;
  rawPayload: unknown;
}

/**
 * Fila de processamento assíncrono dos webhooks da Asaas. O handler HTTP só
 * valida a assinatura e grava a captura bruta (`webhook_logs`) antes de
 * enfileirar — todo o resto (idempotência, atualização de `payment_transactions`,
 * cascata de crédito) roda no worker, fora do ciclo de requisição/resposta.
 *
 * `attempts`/`backoff`: se o processamento falhar (ex.: banco fora do ar por
 * um instante), o BullMQ tenta de novo sozinho — seguro porque cada etapa do
 * processamento já é idempotente (Fase 3/4).
 */
export const asaasWebhookQueue = new Queue<AsaasWebhookJobData, void, typeof ASAAS_WEBHOOK_JOB_NAME>(
  ASAAS_WEBHOOK_QUEUE_NAME,
  {
    connection: queueConnection,
    defaultJobOptions: {
      attempts: 5,
      backoff: { type: "exponential", delay: 2000 },
      removeOnComplete: { age: 60 * 60 * 24 * 7, count: 1000 },
      removeOnFail: { age: 60 * 60 * 24 * 30 },
    },
  },
);
