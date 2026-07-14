import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { v4 as uuidv4 } from "uuid";
import { db } from "../infrastructure/database/client";
import { botUsers, wallets, walletTransactions } from "../infrastructure/database/schema";
import { walletService } from "./wallet.service";

/**
 * Testes de integração contra o banco real de desenvolvimento — o
 * `WalletService` é o único ponto permitido de mutação de saldo do sistema
 * (dinheiro de verdade em produção), então as garantias centrais dele
 * (idempotência, saldo nunca negativo sem opt-in, serialização sob
 * concorrência) precisam ser provadas contra transações de banco reais, não
 * contra um mock que não reproduziria `SELECT ... FOR UPDATE`.
 */
describe("WalletService (integração, banco real)", () => {
  let userId: number;
  let recipientId: number;

  beforeAll(async () => {
    const stamp = Date.now();
    const [user] = await db
      .insert(botUsers)
      .values({
        name: "Wallet Test User",
        email: `wallet-test-${stamp}@test.local`,
        password: "x",
        phoneNumber: "11900000000",
        adress: "Rua Teste, 1",
        pixCode: "chave-teste",
      })
      .$returningId();
    const [recipient] = await db
      .insert(botUsers)
      .values({
        name: "Wallet Test Recipient",
        email: `wallet-test-recipient-${stamp}@test.local`,
        password: "x",
        phoneNumber: "11900000001",
        adress: "Rua Teste, 2",
        pixCode: "chave-teste-2",
      })
      .$returningId();
    userId = user.id;
    recipientId = recipient.id;
  });

  afterAll(async () => {
    const ids = [userId, recipientId];
    await db.delete(walletTransactions).where(inArray(walletTransactions.userId, ids));
    await db.delete(wallets).where(inArray(wallets.userId, ids));
    await db.delete(botUsers).where(inArray(botUsers.id, ids));
  });

  it("credit aumenta o saldo a partir de zero", async () => {
    const result = await walletService.credit({
      userId,
      amount: 100,
      origin: "deposit",
      idempotencyKey: uuidv4(),
    });

    expect(result.duplicate).toBe(false);
    expect(result.balanceAfter).toBe(100);
    expect(await walletService.getBalance(userId)).toBe(100);
  });

  it("debit reduz o saldo", async () => {
    const result = await walletService.debit({
      userId,
      amount: 30,
      origin: "withdrawal",
      idempotencyKey: uuidv4(),
    });

    expect(result.balanceAfter).toBe(70);
    expect(await walletService.getBalance(userId)).toBe(70);
  });

  it("debit que deixaria o saldo negativo é rejeitado por padrão", async () => {
    const balanceBefore = await walletService.getBalance(userId);

    await expect(
      walletService.debit({
        userId,
        amount: balanceBefore + 1000,
        origin: "withdrawal",
        idempotencyKey: uuidv4(),
      }),
    ).rejects.toThrow("Saldo insuficiente");

    expect(await walletService.getBalance(userId)).toBe(balanceBefore);
  });

  it("debit com allowNegative permite saldo negativo", async () => {
    const balanceBefore = await walletService.getBalance(userId);

    const result = await walletService.debit({
      userId,
      amount: balanceBefore + 50,
      origin: "withdrawal",
      idempotencyKey: uuidv4(),
      allowNegative: true,
    });

    expect(result.balanceAfter).toBe(-50);

    // Devolve o saldo para 0 para não contaminar os testes seguintes.
    await walletService.credit({ userId, amount: 50, origin: "admin_adjustment", idempotencyKey: uuidv4() });
  });

  it("idempotencyKey repetida não duplica o lançamento", async () => {
    const idempotencyKey = uuidv4();
    const balanceBefore = await walletService.getBalance(userId);

    const first = await walletService.credit({ userId, amount: 25, origin: "deposit", idempotencyKey });
    const second = await walletService.credit({ userId, amount: 25, origin: "deposit", idempotencyKey });

    expect(first.duplicate).toBe(false);
    expect(second.duplicate).toBe(true);
    expect(second.balanceAfter).toBe(first.balanceAfter);
    expect(await walletService.getBalance(userId)).toBe(balanceBefore + 25);

    const rows = await db.select().from(walletTransactions).where(eq(walletTransactions.idempotencyKey, idempotencyKey));
    expect(rows).toHaveLength(1);
  });

  it("transferBetweenUsers move o valor atomicamente entre dois usuários", async () => {
    await walletService.credit({ userId, amount: 200, origin: "admin_adjustment", idempotencyKey: uuidv4() });
    const senderBalanceBefore = await walletService.getBalance(userId);
    const recipientBalanceBefore = await walletService.getBalance(recipientId);

    const result = await walletService.transferBetweenUsers({
      fromUserId: userId,
      toUserId: recipientId,
      amount: 40,
      idempotencyKey: uuidv4(),
    });

    expect(result.senderBalanceAfter).toBe(senderBalanceBefore - 40);
    expect(result.recipientBalanceAfter).toBe(recipientBalanceBefore + 40);
    expect(await walletService.getBalance(userId)).toBe(senderBalanceBefore - 40);
    expect(await walletService.getBalance(recipientId)).toBe(recipientBalanceBefore + 40);
  });

  it("débitos concorrentes nunca deixam o saldo negativo (serialização via SELECT ... FOR UPDATE)", async () => {
    const stamp = Date.now();
    const [concurrentUser] = await db
      .insert(botUsers)
      .values({
        name: "Wallet Concurrency User",
        email: `wallet-concurrency-${stamp}@test.local`,
        password: "x",
        phoneNumber: "11900000002",
        adress: "Rua Teste, 3",
        pixCode: "chave-teste-3",
      })
      .$returningId();
    const concurrentUserId = concurrentUser.id;

    try {
      await walletService.credit({ userId: concurrentUserId, amount: 70, origin: "admin_adjustment", idempotencyKey: uuidv4() });

      const results = await Promise.allSettled(
        Array.from({ length: 20 }, () =>
          walletService.debit({
            userId: concurrentUserId,
            amount: 5,
            origin: "withdrawal",
            idempotencyKey: uuidv4(),
          }),
        ),
      );

      const succeeded = results.filter((r) => r.status === "fulfilled");
      const rejected = results.filter((r) => r.status === "rejected");

      // R$70 / R$5 por débito = exatamente 14 cabem, 6 estouram o saldo.
      expect(succeeded).toHaveLength(14);
      expect(rejected).toHaveLength(6);
      expect(await walletService.getBalance(concurrentUserId)).toBe(0);
    } finally {
      await db.delete(walletTransactions).where(eq(walletTransactions.userId, concurrentUserId));
      await db.delete(wallets).where(eq(wallets.userId, concurrentUserId));
      await db.delete(botUsers).where(eq(botUsers.id, concurrentUserId));
    }
  });
});
