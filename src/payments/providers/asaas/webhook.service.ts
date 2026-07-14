import { timingSafeEqual } from "node:crypto";
import { env } from "../../../config/env";
import { ValidationError } from "../../../shared/errors";
import { WebhookEvent, WebhookEventCategory } from "../../interfaces/payment-provider";

interface AsaasWebhookResource {
  id: string;
  status: string;
}

interface AsaasWebhookPayload {
  id?: string;
  event: string;
  payment?: AsaasWebhookResource;
  transfer?: AsaasWebhookResource;
}

function isAsaasWebhookPayload(payload: unknown): payload is AsaasWebhookPayload {
  return typeof payload === "object" && payload !== null && "event" in payload;
}

export class AsaasWebhookService {
  /**
   * A Asaas não assina o corpo da requisição (sem HMAC) — a autenticidade é
   * validada comparando o header `asaas-access-token` com o token
   * configurado manualmente no cadastro do webhook no painel Asaas.
   * `timingSafeEqual` evita que a comparação vaze o token por timing attack.
   */
  verifySignature(signatureHeader: string | undefined): boolean {
    if (!signatureHeader) return false;

    const expected = Buffer.from(env.ASAAS_WEBHOOK_TOKEN);
    const received = Buffer.from(signatureHeader);

    if (expected.length !== received.length) return false;
    return timingSafeEqual(expected, received);
  }

  parseWebhookEvent(payload: unknown): WebhookEvent {
    if (!isAsaasWebhookPayload(payload)) {
      throw new ValidationError("Payload de webhook da Asaas em formato inesperado");
    }

    const resource = payload.payment ?? payload.transfer;
    const category: WebhookEventCategory = payload.payment ? "payment" : payload.transfer ? "transfer" : "unknown";

    return {
      externalEventId: payload.id ?? `${payload.event}:${resource?.id}:${resource?.status}`,
      eventType: payload.event,
      category,
      resourceExternalId: resource?.id ?? null,
      status: resource?.status ?? "UNKNOWN",
      raw: payload,
    };
  }
}
