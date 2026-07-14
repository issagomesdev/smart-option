import { eq } from "drizzle-orm";
import { db } from "../infrastructure/database/client";
import { botUsers, paymentEvents, paymentTransactions, webhookLogs } from "../infrastructure/database/schema";
import { UnauthorizedError } from "../shared/errors";
import { getPaymentProvider } from "./payment.factory";
import { WebhookEvent } from "./interfaces/payment-provider";

export type PaymentTransactionRow = typeof paymentTransactions.$inferSelect;
type PaymentTransactionStatus = PaymentTransactionRow["status"];

interface BotUserLike {
  id: number;
  name: string;
  email: string;
  cpf: string | null;
  phoneNumber: string;
  asaasCustomerId: string | null;
}

export interface CreatePixChargeParams {
  userId: number;
  amount: number;
  type: "deposit" | "subscription";
  description: string;
  productId?: number;
  /** id da linha legada (`checkouts.id`) para a ponte com o cascata de crédito antigo — removido na Fase 4. */
  legacyReferenceId?: string;
}

export interface CreatePixChargeOutcome {
  paymentTransactionId: number;
  externalId: string;
  qrCodeImageBase64: string;
  qrCodePayload: string;
  expiresAt: Date;
}

export interface CreateWithdrawalTransferParams {
  userId: number;
  amount: number;
  pixKey: string;
  description: string;
  legacyReferenceId?: string;
}

export interface CreateWithdrawalTransferOutcome {
  paymentTransactionId: number;
  externalId: string;
  status: string;
}

export interface WebhookReceipt {
  webhookLogId: number;
  event: WebhookEvent;
}

export interface WebhookProcessingResult {
  duplicate: boolean;
  paymentTransaction: PaymentTransactionRow | null;
}

/**
 * O driver mysql2 sinaliza chave duplicada com `error.code === 'ER_DUP_ENTRY'`,
 * mas o Drizzle envolve esse erro num `DrizzleQueryError` e move o original
 * para `error.cause` — por isso é preciso checar os dois níveis.
 */
export function isDuplicateKeyError(error: unknown): boolean {
  const code = (error as { code?: string } | undefined)?.code;
  if (code === "ER_DUP_ENTRY") return true;

  const causeCode = (error as { cause?: { code?: string } } | undefined)?.cause?.code;
  return causeCode === "ER_DUP_ENTRY";
}

/** Traduz o vocabulário de status da Asaas (pagamento e transferência) para o enum interno de `payment_transactions`. */
export function mapAsaasStatus(asaasStatus: string): PaymentTransactionStatus {
  switch (asaasStatus) {
    case "RECEIVED":
    case "CONFIRMED":
    case "RECEIVED_IN_CASH":
    case "DONE":
      return "confirmed";
    case "REFUNDED":
      return "refunded";
    case "CANCELLED":
      return "cancelled";
    case "FAILED":
    case "OVERDUE":
      return "failed";
    case "BANK_PROCESSING":
      return "processing";
    case "PENDING":
      return "pending";
    default:
      return "processing";
  }
}

/**
 * Fachada única do módulo financeiro. Nenhum outro lugar da aplicação deve
 * chamar `getPaymentProvider()`/um provider concreto diretamente, nem
 * escrever em `payment_transactions`/`payment_events`/`webhook_logs` — tudo
 * passa por aqui.
 */
export class PaymentService {
  private readonly provider = getPaymentProvider();

  async ensureCustomer(user: BotUserLike): Promise<string> {
    if (user.asaasCustomerId) return user.asaasCustomerId;

    const { externalCustomerId } = await this.provider.createCustomer({
      name: user.name,
      email: user.email,
      cpfCnpj: user.cpf ?? undefined,
      phone: user.phoneNumber,
      externalReference: String(user.id),
    });

    await db.update(botUsers).set({ asaasCustomerId: externalCustomerId }).where(eq(botUsers.id, user.id));

    return externalCustomerId;
  }

  async createPixCharge(user: BotUserLike, params: CreatePixChargeParams): Promise<CreatePixChargeOutcome> {
    const customerExternalId = await this.ensureCustomer(user);

    const charge = await this.provider.createPixCharge({
      customerExternalId,
      amount: params.amount,
      description: params.description,
      externalReference: params.legacyReferenceId ?? String(params.userId),
    });

    const [inserted] = await db
      .insert(paymentTransactions)
      .values({
        userId: params.userId,
        provider: "asaas",
        type: params.type,
        externalId: charge.externalId,
        status: "pending",
        amount: params.amount.toFixed(2),
        productId: params.productId,
        metadata: params.legacyReferenceId ? { legacyCheckoutId: params.legacyReferenceId } : null,
      })
      .$returningId();

    return {
      paymentTransactionId: inserted.id,
      externalId: charge.externalId,
      qrCodeImageBase64: charge.qrCodeImageBase64,
      qrCodePayload: charge.qrCodePayload,
      expiresAt: charge.expiresAt,
    };
  }

  async createWithdrawalTransfer(
    user: Pick<BotUserLike, "id">,
    params: CreateWithdrawalTransferParams,
  ): Promise<CreateWithdrawalTransferOutcome> {
    const transfer = await this.provider.createTransfer({
      amount: params.amount,
      pixKey: params.pixKey,
      description: params.description,
      externalReference: params.legacyReferenceId ?? String(params.userId),
    });

    const [inserted] = await db
      .insert(paymentTransactions)
      .values({
        userId: user.id,
        provider: "asaas",
        type: "withdrawal",
        externalId: transfer.externalId,
        status: "processing",
        amount: params.amount.toFixed(2),
        metadata: params.legacyReferenceId ? { legacyWithdrawalId: params.legacyReferenceId } : null,
      })
      .$returningId();

    return { paymentTransactionId: inserted.id, externalId: transfer.externalId, status: transfer.status };
  }

  /**
   * Etapa síncrona, chamada pelo handler HTTP: valida a autenticidade e
   * grava a captura bruta em `webhook_logs` — nada além disso, para
   * responder à Asaas o mais rápido possível. O processamento de fato
   * (idempotência, atualização de `payment_transactions`, cascata de
   * crédito) acontece em `processWebhookEvent`, chamado pelo worker da fila.
   */
  async receiveWebhook(signatureHeader: string | undefined, rawPayload: unknown): Promise<WebhookReceipt> {
    if (!this.provider.verifyWebhookSignature(signatureHeader)) {
      throw new UnauthorizedError("Assinatura do webhook da Asaas inválida");
    }

    const event = this.provider.parseWebhookEvent(rawPayload);

    const [webhookLog] = await db
      .insert(webhookLogs)
      .values({
        provider: "asaas",
        eventType: event.eventType,
        externalId: event.resourceExternalId,
        payload: rawPayload as object,
        status: "received",
      })
      .$returningId();

    return { webhookLogId: webhookLog.id, event };
  }

  /**
   * Processamento de fato de um webhook já recebido — roda no worker
   * (`asaas-webhook.worker.ts`), fora do ciclo de requisição/resposta.
   * Garante idempotência via a unique constraint de
   * `payment_events.external_event_id` e atualiza o status da
   * `payment_transactions` correspondente. Não decide o efeito de negócio
   * (crédito de saldo, ativação de plano) — isso é `bridgeToLegacyCascade`,
   * chamado pelo worker com o resultado daqui.
   */
  async processWebhookEvent(webhookLogId: number, event: WebhookEvent, rawPayload: unknown): Promise<WebhookProcessingResult> {
    let duplicate = false;
    try {
      await db.insert(paymentEvents).values({
        provider: "asaas",
        eventType: event.eventType,
        externalEventId: event.externalEventId,
        payload: rawPayload as object,
      });
    } catch (error) {
      if (!isDuplicateKeyError(error)) throw error;
      duplicate = true;
    }

    let paymentTransaction: PaymentTransactionRow | null = null;
    if (!duplicate && event.resourceExternalId) {
      await db
        .update(paymentTransactions)
        .set({ status: mapAsaasStatus(event.status) })
        .where(eq(paymentTransactions.externalId, event.resourceExternalId));

      paymentTransaction =
        (await db.select().from(paymentTransactions).where(eq(paymentTransactions.externalId, event.resourceExternalId)))[0] ??
        null;
    }

    await db
      .update(webhookLogs)
      .set({ status: duplicate ? "duplicate" : "processed", processedAt: new Date() })
      .where(eq(webhookLogs.id, webhookLogId));

    return { duplicate, paymentTransaction };
  }

  async markWebhookFailed(webhookLogId: number, error: unknown): Promise<void> {
    const message = error instanceof Error ? error.message : String(error);
    await db
      .update(webhookLogs)
      .set({ status: "failed", error: message.slice(0, 2000), processedAt: new Date() })
      .where(eq(webhookLogs.id, webhookLogId));
  }

  /**
   * Usado quando o job na fila já existe (mesmo `externalEventId` de uma
   * entrega anterior) — a entrega atual não será processada por um worker
   * (o BullMQ deduplica por `jobId` e reaproveita o job já concluído/em
   * andamento), então marcamos a captura já aqui em vez de deixá-la presa em
   * `received` para sempre.
   */
  async markWebhookDuplicate(webhookLogId: number): Promise<void> {
    await db
      .update(webhookLogs)
      .set({ status: "duplicate", processedAt: new Date() })
      .where(eq(webhookLogs.id, webhookLogId));
  }
}

export const paymentService = new PaymentService();
