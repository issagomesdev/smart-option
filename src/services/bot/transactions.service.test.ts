import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const createPixCharge = vi.fn();
vi.mock("../../payments/payment.service", () => ({
  paymentService: { createPixCharge: (...args: unknown[]) => createPixCharge(...args) },
}));

import { db } from "../../infrastructure/database/client";
import { botUsers, checkouts, userPlans, walletTransactions, wallets, withdrawals } from "../../infrastructure/database/schema";
import { walletService } from "../../wallet/wallet.service";
import { TransactionsService } from "./transactions.service";

/**
 * `TransactionsService` (bot) é a superfície inteira de movimentação
 * financeira do bot do Telegram — depósito (`checkout`/`finishCheckout`),
 * saque, assinatura, transferência entre usuários. Achado real na auditoria
 * da Fase 6: tinha 4,76% de cobertura, o menor de todo o backend depois dos
 * fluxos de conversa do bot em si. `paymentService.createPixCharge` (Asaas)
 * é mockado — o resto roda contra o banco/wallet real.
 */
describe("TransactionsService (bot, integração, banco real)", () => {
  const stamp = Date.now();
  const createdUserIds: number[] = [];
  let counter = 0;

  beforeEach(() => {
    createPixCharge.mockReset();
  });

  afterEach(async () => {
    for (const id of createdUserIds) {
      await db.delete(withdrawals).where(eq(withdrawals.userId, id));
      await db.delete(checkouts).where(eq(checkouts.userId, id));
      await db.delete(userPlans).where(eq(userPlans.userId, id));
      await db.delete(walletTransactions).where(eq(walletTransactions.userId, id));
      await db.delete(wallets).where(eq(wallets.userId, id));
      await db.delete(botUsers).where(eq(botUsers.id, id));
    }
    createdUserIds.length = 0;
  });

  async function insertUser(telegramUserId: string) {
    counter += 1;
    const [user] = await db
      .insert(botUsers)
      .values({
        name: "Transactions Bot Test",
        email: `transactions-bot-test-${stamp}-${counter}@test.local`,
        password: "x",
        phoneNumber: "11900000000",
        adress: "Rua Teste, 1",
        pixCode: "chave-pix-teste",
        telegramUserId,
      })
      .$returningId();
    createdUserIds.push(user.id);
    return user.id;
  }

  function telegramId(offset: number) {
    return 920000000 + Number(String(stamp).slice(-6)) + offset;
  }

  describe("balance", () => {
    it("devolve o saldo a partir do telegramUserId", async () => {
      const tId = telegramId(1);
      const userId = await insertUser(String(tId));
      await walletService.credit({ userId, amount: 100, origin: "deposit", idempotencyKey: `bal-1-${userId}` });

      expect(await TransactionsService.balance(tId, true)).toBe(100);
    });

    it("aceita uma linha de bot_users já resolvida (user.id) em vez do telegramUserId", async () => {
      const userId = await insertUser(String(telegramId(2)));
      await walletService.credit({ userId, amount: 50, origin: "deposit", idempotencyKey: `bal-2-${userId}` });

      expect(await TransactionsService.balance(null, true, { id: userId })).toBe(50);
    });

    it("aceita o formato legado de users_plans (user_id) que o cron ainda usa", async () => {
      const userId = await insertUser(String(telegramId(3)));
      await walletService.credit({ userId, amount: 75, origin: "deposit", idempotencyKey: `bal-3-${userId}` });

      expect(await TransactionsService.balance(null, true, { user_id: userId, product_id: 1 })).toBe(75);
    });
  });

  describe("extract", () => {
    it("devolve o extrato no formato legado esperado pela view do bot", async () => {
      const tId = telegramId(4);
      const userId = await insertUser(String(tId));
      await walletService.credit({ userId, amount: 200, origin: "deposit", idempotencyKey: `ext-${userId}` });

      const rows = await TransactionsService.extract(tId);

      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({ type: "sum", value: "200.00", origin: "deposit" });
    });
  });

  describe("checkoutsRequests", () => {
    it("lista depósitos do usuário", async () => {
      const tId = telegramId(5);
      const userId = await insertUser(String(tId));
      await db.insert(checkouts).values({ referenceId: "ref-list-1", type: "deposit", value: "100.00", userId });

      const rows = await TransactionsService.checkoutsRequests(tId, "deposit");
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({ value: "100.00" });
    });

    it("lista assinaturas do usuário com o nome do produto", async () => {
      const tId = telegramId(6);
      const userId = await insertUser(String(tId));
      await db.insert(checkouts).values({ referenceId: "ref-list-2", type: "subscription", value: "50.00", userId, productId: 1 });

      const rows = await TransactionsService.checkoutsRequests(tId, "subscription");
      expect(rows).toHaveLength(1);
      expect(rows[0]).toHaveProperty("name");
    });

    it("devolve array vazio para um telegramUserId sem usuário correspondente", async () => {
      const rows = await TransactionsService.checkoutsRequests(999999999, "deposit");
      expect(rows).toEqual([]);
    });
  });

  describe("withdrawalRequests / newWithdrawalRequests / hasWithdrawalPendingRequests", () => {
    it("cria uma solicitação de saque e ela aparece na listagem e na checagem de pendência", async () => {
      const tId = telegramId(7);
      await insertUser(String(tId));

      await TransactionsService.newWithdrawalRequests(tId, 80);

      const rows = await TransactionsService.withdrawalRequests(tId);
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({ value: "80.00", status: "pending" });

      expect(await TransactionsService.hasWithdrawalPendingRequests(tId)).toBe(true);
    });

    it("hasWithdrawalPendingRequests é false sem nenhuma solicitação pendente", async () => {
      const tId = telegramId(8);
      await insertUser(String(tId));
      expect(await TransactionsService.hasWithdrawalPendingRequests(tId)).toBe(false);
    });
  });

  describe("checkout", () => {
    it("cria a cobrança PIX (depósito) e grava o transactionId retornado pelo provider", async () => {
      const tId = telegramId(9);
      const userId = await insertUser(String(tId));
      createPixCharge.mockResolvedValue({
        paymentTransactionId: 1,
        externalId: "ext-123",
        qrCodeImageBase64: "base64",
        qrCodePayload: "copia-e-cola",
        expiresAt: new Date(),
      });

      const result = await TransactionsService.checkout(tId, 100);

      expect(result).toMatchObject({ qrCodePayload: "copia-e-cola" });
      const [row] = await db.select().from(checkouts).where(eq(checkouts.userId, userId));
      expect(row).toMatchObject({ type: "deposit", value: "100.00", transactionId: "ext-123" });
    });

    it("com um produto, cria como assinatura e descreve o plano na cobrança", async () => {
      const tId = telegramId(10);
      const userId = await insertUser(String(tId));
      createPixCharge.mockResolvedValue({
        paymentTransactionId: 2,
        externalId: "ext-456",
        qrCodeImageBase64: "base64",
        qrCodePayload: "copia-e-cola",
        expiresAt: new Date(),
      });

      await TransactionsService.checkout(tId, 50, { id: 1, name: "Bronze" });

      expect(createPixCharge).toHaveBeenCalledWith(
        expect.objectContaining({ id: userId }),
        expect.objectContaining({ type: "subscription", description: expect.stringContaining("Bronze") }),
      );
      const [row] = await db.select().from(checkouts).where(eq(checkouts.userId, userId));
      expect(row).toMatchObject({ type: "subscription", productId: 1 });
    });
  });

  describe("finishCheckout", () => {
    it("status PAID num depósito credita a wallet do usuário", async () => {
      const userId = await insertUser(String(telegramId(11)));
      const [{ id: checkoutId }] = await db
        .insert(checkouts)
        .values({ referenceId: "ref-finish-1", type: "deposit", value: "300.00", userId })
        .$returningId();

      await TransactionsService.finishCheckout(String(checkoutId), "PAID");

      expect(await walletService.getBalance(userId)).toBe(300);
      const [row] = await db.select().from(checkouts).where(eq(checkouts.id, checkoutId));
      expect(row.status).toBe("PAID");
    });

    it("chamar de novo com o mesmo status é um no-op (não credita duas vezes)", async () => {
      const userId = await insertUser(String(telegramId(12)));
      const [{ id: checkoutId }] = await db
        .insert(checkouts)
        .values({ referenceId: "ref-finish-2", type: "deposit", value: "100.00", userId })
        .$returningId();

      await TransactionsService.finishCheckout(String(checkoutId), "PAID");
      await TransactionsService.finishCheckout(String(checkoutId), "PAID");

      expect(await walletService.getBalance(userId)).toBe(100);
    });

    it("status PAID numa assinatura ativa o plano do usuário", async () => {
      const userId = await insertUser(String(telegramId(13)));
      const [{ id: checkoutId }] = await db
        .insert(checkouts)
        .values({ referenceId: "ref-finish-3", type: "subscription", value: "0.00", userId, productId: 1 })
        .$returningId();

      await TransactionsService.finishCheckout(String(checkoutId), "PAID");

      const [plan] = await db.select().from(userPlans).where(eq(userPlans.userId, userId));
      expect(plan).toMatchObject({ productId: 1, status: 1 });
    });

    it("status diferente de PAID só atualiza o status, sem creditar nada", async () => {
      const userId = await insertUser(String(telegramId(14)));
      const [{ id: checkoutId }] = await db
        .insert(checkouts)
        .values({ referenceId: "ref-finish-4", type: "deposit", value: "999.00", userId })
        .$returningId();

      await TransactionsService.finishCheckout(String(checkoutId), "DECLINED");

      const [row] = await db.select().from(checkouts).where(eq(checkouts.id, checkoutId));
      expect(row.status).toBe("DECLINED");
      expect(await walletService.getBalance(userId)).toBe(0);
    });

    it("id de checkout inexistente é um no-op silencioso (usado pelo webhook, não pode lançar)", async () => {
      await expect(TransactionsService.finishCheckout("999999999", "PAID")).resolves.toBeUndefined();
    });
  });

  describe("renewTuition", () => {
    it("debita o preço do plano e atualiza o vencimento", async () => {
      const userId = await insertUser(String(telegramId(15)));
      await walletService.credit({ userId, amount: 200, origin: "deposit", idempotencyKey: `renew-${userId}` });
      await db.insert(userPlans).values({ userId, productId: 1, expiredIn: new Date() });

      await TransactionsService.renewTuition({ user_id: userId, product_id: 1 }, { id: 1, price: "50.00" });

      expect(await walletService.getBalance(userId)).toBe(150);
    });
  });

  describe("subscriptionWithBalance", () => {
    it("debita o preço e cria o plano do usuário quando ele ainda não tem um", async () => {
      const tId = telegramId(16);
      const userId = await insertUser(String(tId));
      await walletService.credit({ userId, amount: 200, origin: "deposit", idempotencyKey: `subbal-${userId}` });

      await TransactionsService.subscriptionWithBalance(tId, { id: 1, price: "80.00" });

      expect(await walletService.getBalance(userId)).toBe(120);
      const [plan] = await db.select().from(userPlans).where(eq(userPlans.userId, userId));
      expect(plan).toMatchObject({ productId: 1, status: 1 });
    });
  });

  describe("transfersBetweenUsers", () => {
    it("transfere saldo do remetente para o destinatário por e-mail", async () => {
      const senderTId = telegramId(17);
      const senderId = await insertUser(String(senderTId));
      const recipientId = await insertUser(String(telegramId(18)));
      await walletService.credit({ userId: senderId, amount: 100, origin: "deposit", idempotencyKey: `transfer-${senderId}` });

      const [recipient] = await db.select({ email: botUsers.email }).from(botUsers).where(eq(botUsers.id, recipientId));
      const message = await TransactionsService.transfersBetweenUsers(40, senderTId, recipient.email);

      expect(message).toBe("Transferência concluída com sucesso!");
      expect(await walletService.getBalance(senderId)).toBe(60);
      expect(await walletService.getBalance(recipientId)).toBe(40);
    });
  });
});
