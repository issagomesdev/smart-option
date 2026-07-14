import { PaymentTransactionRow } from "./payment.service";
import { WebhookEvent } from "./interfaces/payment-provider";
import { TransactionsService } from "../services/bot/transactions.service";
import { RequestService } from "../services/requests.service";

/**
 * Adaptador: traduz o evento da Asaas (`payment_transactions`) para as
 * chamadas de `finishCheckout`/`finishWithdrawal`, que continuam sendo o
 * único lugar que decide o efeito de negócio de uma cobrança/transferência
 * confirmada (crédito na wallet via `WalletService`, ativação de plano,
 * repasse de afiliados). `checkouts`/`withdrawals` não são tabelas
 * transitórias — `checkouts` registra a intenção de cobrança e `withdrawals`
 * é a fila de aprovação humana do saque, um conceito que não existe em
 * `payment_transactions`. Por isso esta ponte é permanente, não legado a
 * remover. Chamada pelo worker da fila (`asaas-webhook.worker.ts`).
 */
export async function bridgeToLegacyCascade(event: WebhookEvent, paymentTransaction: PaymentTransactionRow): Promise<void> {
  const metadata = paymentTransaction.metadata as
    | { legacyCheckoutId?: string; legacyWithdrawalId?: string }
    | null;

  if (event.category === "payment" && metadata?.legacyCheckoutId) {
    await TransactionsService.finishCheckout(metadata.legacyCheckoutId, mapToLegacyCheckoutStatus(paymentTransaction.status));
    return;
  }

  if (event.category === "transfer" && metadata?.legacyWithdrawalId) {
    const confirmed = paymentTransaction.status === "confirmed";
    await RequestService.finishWithdrawal({
      reference_id: metadata.legacyWithdrawalId,
      status: confirmed ? "SUCCESS" : "FAILED",
      error_messages: confirmed ? undefined : [{ description: `Status Asaas: ${event.status}` }],
    });
  }
}

function mapToLegacyCheckoutStatus(status: PaymentTransactionRow["status"]): string {
  switch (status) {
    case "confirmed":
      return "PAID";
    case "cancelled":
      return "CANCELED";
    case "refunded":
    case "failed":
      return "DECLINED";
    case "processing":
      return "IN_ANALYSIS";
    default:
      return "PENDING";
  }
}
