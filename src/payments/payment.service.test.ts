import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// `vi.hoisted` (não um `const` comum) de propósito: `payment.service.ts`
// constrói seu singleton (`export const paymentService = new PaymentService()`)
// como efeito colateral da própria importação — como imports ES são sempre
// avaliados antes de qualquer outro código do arquivo, um `const provider`
// comum ainda estaria em TDZ nesse momento. `vi.hoisted` sobe junto com
// `vi.mock` para antes de qualquer import, resolvendo isso.
const { provider } = vi.hoisted(() => ({
  provider: {
    createCustomer: vi.fn(),
    createPixCharge: vi.fn(),
    createTransfer: vi.fn(),
    verifyWebhookSignature: vi.fn(),
    parseWebhookEvent: vi.fn(),
  },
}));

vi.mock("./payment.factory", () => ({
  getPaymentProvider: () => provider,
}));

import { db } from "../infrastructure/database/client";
import { botUsers, paymentEvents, paymentTransactions, webhookLogs } from "../infrastructure/database/schema";
import { UnauthorizedError } from "../shared/errors";
import { PaymentService } from "./payment.service";

/**
 * Fachada única do módulo financeiro Asaas — achado real da auditoria de
 * cobertura da Fase 6: só `isDuplicateKeyError`/`mapAsaasStatus` (funções
 * puras) tinham teste (`payment.service.logic.test.ts`); a classe em si,
 * incluindo o processamento de webhook (o caminho que credita saldo/ativa
 * plano de verdade), estava com 31,91%. O provider (Asaas) é mockado — o
 * resto roda contra o banco real.
 */
describe("PaymentService (integração, banco real, provider mockado)", () => {
  const stamp = Date.now();
  const createdUserIds: number[] = [];
  const createdTransactionIds: number[] = [];
  let counter = 0;
  let service: PaymentService;

  beforeEach(() => {
    service = new PaymentService();
    provider.createCustomer.mockReset();
    provider.createPixCharge.mockReset();
    provider.createTransfer.mockReset();
    provider.verifyWebhookSignature.mockReset();
    provider.parseWebhookEvent.mockReset();
  });

  afterEach(async () => {
    for (const id of createdTransactionIds) {
      await db.delete(paymentEvents).where(eq(paymentEvents.paymentTransactionId, id));
      await db.delete(paymentTransactions).where(eq(paymentTransactions.id, id));
    }
    createdTransactionIds.length = 0;

    for (const id of createdUserIds) {
      await db.delete(botUsers).where(eq(botUsers.id, id));
    }
    createdUserIds.length = 0;
  });

  async function insertUser(overrides: Partial<typeof botUsers.$inferInsert> = {}) {
    counter += 1;
    const [user] = await db
      .insert(botUsers)
      .values({
        name: "Payment Service Test",
        email: `payment-service-test-${stamp}-${counter}@test.local`,
        password: "x",
        phoneNumber: "11900000000",
        adress: "Rua Teste, 1",
        pixCode: "chave-pix-teste",
        cpf: "52998224725",
        ...overrides,
      })
      .$returningId();
    createdUserIds.push(user.id);
    return user.id;
  }

  describe("ensureCustomer", () => {
    it("devolve o asaasCustomerId já existente sem chamar o provider", async () => {
      const userId = await insertUser({ asaasCustomerId: "cus_existing" });
      const [user] = await db.select().from(botUsers).where(eq(botUsers.id, userId));

      const result = await service.ensureCustomer(user);

      expect(result).toBe("cus_existing");
      expect(provider.createCustomer).not.toHaveBeenCalled();
    });

    it("sem asaasCustomerId: cria o customer no provider e persiste o id retornado", async () => {
      const userId = await insertUser();
      const [user] = await db.select().from(botUsers).where(eq(botUsers.id, userId));
      provider.createCustomer.mockResolvedValue({ externalCustomerId: "cus_new" });

      const result = await service.ensureCustomer(user);

      expect(result).toBe("cus_new");
      const [updated] = await db.select().from(botUsers).where(eq(botUsers.id, userId));
      expect(updated.asaasCustomerId).toBe("cus_new");
    });
  });

  describe("createPixCharge", () => {
    it("cria a cobrança no provider e grava payment_transactions com status pending", async () => {
      const userId = await insertUser({ asaasCustomerId: "cus_1" });
      const [user] = await db.select().from(botUsers).where(eq(botUsers.id, userId));
      provider.createPixCharge.mockResolvedValue({
        externalId: "pay_ext_1",
        status: "PENDING",
        qrCodeImageBase64: "base64",
        qrCodePayload: "copia-e-cola",
        expiresAt: new Date(),
      });

      const result = await service.createPixCharge(user, { userId, amount: 100, type: "deposit", description: "Depósito" });
      createdTransactionIds.push(result.paymentTransactionId);

      expect(result).toMatchObject({ externalId: "pay_ext_1", qrCodePayload: "copia-e-cola" });
      const [row] = await db.select().from(paymentTransactions).where(eq(paymentTransactions.id, result.paymentTransactionId));
      expect(row).toMatchObject({ userId, type: "deposit", status: "pending", amount: "100.00", externalId: "pay_ext_1" });
    });

    it("com legacyReferenceId: usa como externalReference no provider e grava em metadata", async () => {
      const userId = await insertUser({ asaasCustomerId: "cus_2" });
      const [user] = await db.select().from(botUsers).where(eq(botUsers.id, userId));
      provider.createPixCharge.mockResolvedValue({
        externalId: "pay_ext_2",
        status: "PENDING",
        qrCodeImageBase64: "base64",
        qrCodePayload: "copia-e-cola",
        expiresAt: new Date(),
      });

      const result = await service.createPixCharge(user, {
        userId,
        amount: 50,
        type: "subscription",
        description: "Plano",
        productId: 1,
        legacyReferenceId: "checkout-42",
      });
      createdTransactionIds.push(result.paymentTransactionId);

      expect(provider.createPixCharge).toHaveBeenCalledWith(expect.objectContaining({ externalReference: "checkout-42" }));
      const [row] = await db.select().from(paymentTransactions).where(eq(paymentTransactions.id, result.paymentTransactionId));
      expect(row.metadata).toEqual({ legacyCheckoutId: "checkout-42" });
    });
  });

  describe("createWithdrawalTransfer", () => {
    it("cria a transferência no provider e grava payment_transactions com status processing", async () => {
      const userId = await insertUser();
      provider.createTransfer.mockResolvedValue({ externalId: "transfer_ext_1", status: "PENDING" });

      const result = await service.createWithdrawalTransfer(
        { id: userId },
        { userId, amount: 200, pixKey: "chave@pix.com", description: "Saque" },
      );
      createdTransactionIds.push(result.paymentTransactionId);

      expect(result).toMatchObject({ externalId: "transfer_ext_1" });
      const [row] = await db.select().from(paymentTransactions).where(eq(paymentTransactions.id, result.paymentTransactionId));
      expect(row).toMatchObject({ userId, type: "withdrawal", status: "processing", amount: "200.00" });
    });
  });

  describe("receiveWebhook", () => {
    it("assinatura inválida lança UnauthorizedError sem gravar nada", async () => {
      provider.verifyWebhookSignature.mockReturnValue(false);

      await expect(service.receiveWebhook("assinatura-errada", {})).rejects.toThrow(UnauthorizedError);
      expect(provider.parseWebhookEvent).not.toHaveBeenCalled();
    });

    it("assinatura válida: grava a captura bruta em webhook_logs com status received", async () => {
      provider.verifyWebhookSignature.mockReturnValue(true);
      const event = { externalEventId: "evt_1", eventType: "PAYMENT_RECEIVED", category: "payment" as const, resourceExternalId: "pay_1", status: "RECEIVED", raw: {} };
      provider.parseWebhookEvent.mockReturnValue(event);

      const receipt = await service.receiveWebhook("assinatura-valida", { some: "payload" });

      expect(receipt.event).toEqual(event);
      const [row] = await db.select().from(webhookLogs).where(eq(webhookLogs.id, receipt.webhookLogId));
      expect(row).toMatchObject({ status: "received", eventType: "PAYMENT_RECEIVED", externalId: "pay_1" });

      await db.delete(webhookLogs).where(eq(webhookLogs.id, receipt.webhookLogId));
    });
  });

  describe("processWebhookEvent", () => {
    async function insertWebhookLog() {
      const [log] = await db.insert(webhookLogs).values({ eventType: "PAYMENT_RECEIVED", payload: {}, status: "received" }).$returningId();
      return log.id;
    }

    it("evento novo: grava em payment_events, atualiza o status da transação e marca o log como processed", async () => {
      const userId = await insertUser();
      const [transaction] = await db
        .insert(paymentTransactions)
        .values({ userId, type: "deposit", externalId: "pay_process_1", status: "pending", amount: "100.00" })
        .$returningId();
      createdTransactionIds.push(transaction.id);
      const webhookLogId = await insertWebhookLog();

      const event = {
        externalEventId: `evt-process-${stamp}-1`,
        eventType: "PAYMENT_RECEIVED",
        category: "payment" as const,
        resourceExternalId: "pay_process_1",
        status: "RECEIVED",
        raw: {},
      };

      const result = await service.processWebhookEvent(webhookLogId, event, { raw: true });

      expect(result.duplicate).toBe(false);
      expect(result.paymentTransaction).toMatchObject({ id: transaction.id, status: "confirmed" });

      const [log] = await db.select().from(webhookLogs).where(eq(webhookLogs.id, webhookLogId));
      expect(log.status).toBe("processed");

      await db.delete(webhookLogs).where(eq(webhookLogs.id, webhookLogId));
    });

    it("evento repetido (mesmo externalEventId): não atualiza a transação de novo, marca o log como duplicate", async () => {
      const userId = await insertUser();
      const [transaction] = await db
        .insert(paymentTransactions)
        .values({ userId, type: "deposit", externalId: "pay_process_2", status: "pending", amount: "100.00" })
        .$returningId();
      createdTransactionIds.push(transaction.id);

      const event = {
        externalEventId: `evt-process-${stamp}-2`,
        eventType: "PAYMENT_RECEIVED",
        category: "payment" as const,
        resourceExternalId: "pay_process_2",
        status: "RECEIVED",
        raw: {},
      };

      const firstLogId = await insertWebhookLog();
      await service.processWebhookEvent(firstLogId, event, {});

      const secondLogId = await insertWebhookLog();
      const result = await service.processWebhookEvent(secondLogId, event, {});

      expect(result.duplicate).toBe(true);
      expect(result.paymentTransaction).toBeNull();

      const [secondLog] = await db.select().from(webhookLogs).where(eq(webhookLogs.id, secondLogId));
      expect(secondLog.status).toBe("duplicate");

      await db.delete(webhookLogs).where(eq(webhookLogs.id, firstLogId));
      await db.delete(webhookLogs).where(eq(webhookLogs.id, secondLogId));
    });

    it("evento sem resourceExternalId: não toca payment_transactions, mas ainda marca o log como processed", async () => {
      const webhookLogId = await insertWebhookLog();
      const event = {
        externalEventId: `evt-process-${stamp}-3`,
        eventType: "TRANSFER_UNKNOWN",
        category: "unknown" as const,
        resourceExternalId: null,
        status: "UNKNOWN",
        raw: {},
      };

      const result = await service.processWebhookEvent(webhookLogId, event, {});

      expect(result.paymentTransaction).toBeNull();
      const [log] = await db.select().from(webhookLogs).where(eq(webhookLogs.id, webhookLogId));
      expect(log.status).toBe("processed");

      await db.delete(webhookLogs).where(eq(webhookLogs.id, webhookLogId));
    });
  });

  describe("markWebhookFailed / markWebhookDuplicate", () => {
    it("markWebhookFailed grava a mensagem de erro e marca o log como failed", async () => {
      const [log] = await db.insert(webhookLogs).values({ payload: {}, status: "received" }).$returningId();

      await service.markWebhookFailed(log.id, new Error("Falha ao processar"));

      const [row] = await db.select().from(webhookLogs).where(eq(webhookLogs.id, log.id));
      expect(row).toMatchObject({ status: "failed", error: "Falha ao processar" });
      expect(row.processedAt).not.toBeNull();

      await db.delete(webhookLogs).where(eq(webhookLogs.id, log.id));
    });

    it("markWebhookDuplicate marca o log como duplicate", async () => {
      const [log] = await db.insert(webhookLogs).values({ payload: {}, status: "received" }).$returningId();

      await service.markWebhookDuplicate(log.id);

      const [row] = await db.select().from(webhookLogs).where(eq(webhookLogs.id, log.id));
      expect(row.status).toBe("duplicate");

      await db.delete(webhookLogs).where(eq(webhookLogs.id, log.id));
    });
  });
});
