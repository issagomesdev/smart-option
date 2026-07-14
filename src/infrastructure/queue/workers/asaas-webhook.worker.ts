import { Job, Worker } from "bullmq";
import { queueConnection } from "../connection";
import { ASAAS_WEBHOOK_JOB_NAME, ASAAS_WEBHOOK_QUEUE_NAME, AsaasWebhookJobData } from "../queues/asaas-webhook.queue";
import { paymentService } from "../../../payments/payment.service";
import { bridgeToLegacyCascade } from "../../../payments/webhook-legacy-bridge";
import { getPaymentProvider } from "../../../payments/payment.factory";
import { logger } from "../../../shared/logger";

export async function processJob(job: Job<AsaasWebhookJobData, void, typeof ASAAS_WEBHOOK_JOB_NAME>): Promise<void> {
  const { webhookLogId, rawPayload } = job.data;
  const event = getPaymentProvider().parseWebhookEvent(rawPayload);

  const { duplicate, paymentTransaction } = await paymentService.processWebhookEvent(webhookLogId, event, rawPayload);

  if (!duplicate && paymentTransaction) {
    await bridgeToLegacyCascade(event, paymentTransaction);
  }
}

type AsaasWebhookWorker = Worker<AsaasWebhookJobData, void, typeof ASAAS_WEBHOOK_JOB_NAME>;

let worker: AsaasWebhookWorker | null = null;

export function startAsaasWebhookWorker(): AsaasWebhookWorker {
  if (worker) return worker;

  worker = new Worker<AsaasWebhookJobData, void, typeof ASAAS_WEBHOOK_JOB_NAME>(ASAAS_WEBHOOK_QUEUE_NAME, processJob, {
    connection: queueConnection,
    concurrency: 5,
  });

  worker.on("completed", (job) => {
    logger.info({ jobId: job.id, webhookLogId: job.data.webhookLogId }, "Webhook Asaas processado");
  });

  worker.on("failed", async (job, err) => {
    logger.error(
      { jobId: job?.id, webhookLogId: job?.data.webhookLogId, attemptsMade: job?.attemptsMade, err },
      "Falha ao processar webhook Asaas",
    );

    // Só marca como falho de vez quando o BullMQ esgotou as tentativas —
    // antes disso ainda vai tentar de novo sozinho (backoff exponencial).
    if (job && job.attemptsMade >= (job.opts.attempts ?? 1)) {
      await paymentService.markWebhookFailed(job.data.webhookLogId, err);
    }
  });

  return worker;
}

export async function stopAsaasWebhookWorker(): Promise<void> {
  await worker?.close();
  worker = null;
}
