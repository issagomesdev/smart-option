import { describe, expect, it, vi } from "vitest";

const finishCheckout = vi.fn();
vi.mock("../services/bot/transactions.service", () => ({
  TransactionsService: { finishCheckout: (...args: unknown[]) => finishCheckout(...args) },
}));

const finishWithdrawal = vi.fn();
vi.mock("../services/requests.service", () => ({
  RequestService: { finishWithdrawal: (...args: unknown[]) => finishWithdrawal(...args) },
}));

import type { PaymentTransactionRow } from "./payment.service";
import type { WebhookEvent } from "./interfaces/payment-provider";
import { bridgeToLegacyCascade } from "./webhook-legacy-bridge";

/**
 * Adaptador entre um webhook confirmado da Asaas e o efeito de negócio real
 * (crédito de saldo, ativação de plano, conclusão de saque) — achado real da
 * auditoria de cobertura da Fase 6: 0%, apesar de ser literalmente o
 * interruptor entre "a Asaas confirmou o pagamento" e "o dinheiro de fato
 * aparece para o usuário". `TransactionsService`/`RequestService` são
 * mockados de propósito — o objetivo aqui é provar o roteamento (categoria +
 * metadata → chamada certa, com o status certo), não repetir os testes de
 * negócio que já existem em `transactions.service.test.ts`/
 * `requests.service.test.ts`.
 */
describe("bridgeToLegacyCascade", () => {
  const baseEvent: WebhookEvent = {
    externalEventId: "evt-1",
    eventType: "PAYMENT_RECEIVED",
    category: "payment",
    resourceExternalId: "pay_1",
    status: "RECEIVED",
    raw: {},
  };

  function transaction(overrides: Partial<PaymentTransactionRow>): PaymentTransactionRow {
    return {
      id: 1,
      userId: 1,
      provider: "asaas",
      type: "deposit",
      externalId: "pay_1",
      status: "confirmed",
      amount: "100.00",
      productId: null,
      metadata: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    } as PaymentTransactionRow;
  }

  it.each([
    ["confirmed", "PAID"],
    ["cancelled", "CANCELED"],
    ["refunded", "DECLINED"],
    ["failed", "DECLINED"],
    ["processing", "IN_ANALYSIS"],
    ["pending", "PENDING"],
  ] as const)("categoria payment com legacyCheckoutId: status '%s' vira '%s' em finishCheckout", async (status, expectedLegacyStatus) => {
    finishCheckout.mockReset();
    const paymentTransaction = transaction({ status, metadata: { legacyCheckoutId: "checkout-42" } });

    await bridgeToLegacyCascade(baseEvent, paymentTransaction);

    expect(finishCheckout).toHaveBeenCalledWith("checkout-42", expectedLegacyStatus);
  });

  it("categoria payment sem legacyCheckoutId no metadata: não chama finishCheckout", async () => {
    finishCheckout.mockReset();
    const paymentTransaction = transaction({ metadata: null });

    await bridgeToLegacyCascade(baseEvent, paymentTransaction);

    expect(finishCheckout).not.toHaveBeenCalled();
  });

  it("categoria transfer + legacyWithdrawalId + status confirmed: finishWithdrawal com SUCCESS, sem error_messages", async () => {
    finishWithdrawal.mockReset();
    const event: WebhookEvent = { ...baseEvent, category: "transfer" };
    const paymentTransaction = transaction({ type: "withdrawal", status: "confirmed", metadata: { legacyWithdrawalId: "withdrawal-7" } });

    await bridgeToLegacyCascade(event, paymentTransaction);

    expect(finishWithdrawal).toHaveBeenCalledWith({ reference_id: "withdrawal-7", status: "SUCCESS", error_messages: undefined });
  });

  it("categoria transfer + legacyWithdrawalId + status não confirmado: finishWithdrawal com FAILED e a causa do erro", async () => {
    finishWithdrawal.mockReset();
    const event: WebhookEvent = { ...baseEvent, category: "transfer", status: "FAILED" };
    const paymentTransaction = transaction({ type: "withdrawal", status: "failed", metadata: { legacyWithdrawalId: "withdrawal-8" } });

    await bridgeToLegacyCascade(event, paymentTransaction);

    expect(finishWithdrawal).toHaveBeenCalledWith({
      reference_id: "withdrawal-8",
      status: "FAILED",
      error_messages: [{ description: "Status Asaas: FAILED" }],
    });
  });

  it("categoria transfer sem legacyWithdrawalId no metadata: não chama finishWithdrawal", async () => {
    finishWithdrawal.mockReset();
    const event: WebhookEvent = { ...baseEvent, category: "transfer" };
    const paymentTransaction = transaction({ type: "withdrawal", metadata: null });

    await bridgeToLegacyCascade(event, paymentTransaction);

    expect(finishWithdrawal).not.toHaveBeenCalled();
  });

  it("categoria unknown: não chama nenhum dos dois services", async () => {
    finishCheckout.mockReset();
    finishWithdrawal.mockReset();
    const event: WebhookEvent = { ...baseEvent, category: "unknown" };
    const paymentTransaction = transaction({ metadata: { legacyCheckoutId: "checkout-99" } });

    await bridgeToLegacyCascade(event, paymentTransaction);

    expect(finishCheckout).not.toHaveBeenCalled();
    expect(finishWithdrawal).not.toHaveBeenCalled();
  });
});
