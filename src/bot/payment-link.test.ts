import TelegramBot from "node-telegram-bot-api";
import { beforeEach, describe, expect, it, vi } from "vitest";

const checkout = vi.fn();
vi.mock("../services/bot/transactions.service", () => ({
  TransactionsService: { checkout: (...args: unknown[]) => checkout(...args) },
}));

import { generatePaymentLink } from "./payment-link";

/** `generatePaymentLink`: gera a cobrança PIX via `TransactionsService.checkout` (mockado, já testado em `transactions.service.test.ts`) e envia QR Code + copia-e-cola. */
describe("generatePaymentLink", () => {
  const chatId = 1;
  const userId = 123;

  function fakeBot(): TelegramBot {
    return {
      sendMessage: vi.fn().mockResolvedValue({}),
      sendPhoto: vi.fn().mockResolvedValue({}),
      sendChatAction: vi.fn().mockResolvedValue({}),
    } as unknown as TelegramBot;
  }

  beforeEach(() => {
    checkout.mockReset();
  });

  it("gera a cobrança e envia QR Code + copia-e-cola", async () => {
    checkout.mockResolvedValue({
      paymentTransactionId: 1,
      externalId: "ext-1",
      qrCodeImageBase64: Buffer.from("fake-image").toString("base64"),
      qrCodePayload: "codigo-copia-e-cola",
      expiresAt: new Date("2026-01-01T12:00:00Z"),
    });
    const bot = fakeBot();

    await generatePaymentLink(bot, chatId, userId, 100);

    expect(checkout).toHaveBeenCalledWith(userId, 100, null);
    expect(bot.sendPhoto).toHaveBeenCalledWith(chatId, expect.any(Buffer));
    expect(bot.sendMessage).toHaveBeenCalledWith(chatId, expect.stringContaining("codigo-copia-e-cola"), { parse_mode: "Markdown" });
  });

  it("com um produto informado, repassa para o checkout", async () => {
    checkout.mockResolvedValue({
      paymentTransactionId: 2,
      externalId: "ext-2",
      qrCodeImageBase64: Buffer.from("x").toString("base64"),
      qrCodePayload: "codigo-2",
      expiresAt: new Date(),
    });
    const bot = fakeBot();
    const product = { id: 1, name: "Bronze" };

    await generatePaymentLink(bot, chatId, userId, 50, product);

    expect(checkout).toHaveBeenCalledWith(userId, 50, product);
  });

  it("erro do service: mostra o erro sem lançar", async () => {
    checkout.mockRejectedValue(new Error("Asaas fora do ar"));
    const bot = fakeBot();

    await generatePaymentLink(bot, chatId, userId, 100);

    expect(bot.sendMessage).toHaveBeenCalledWith(chatId, expect.stringContaining("Asaas fora do ar"), expect.anything());
    expect(bot.sendPhoto).not.toHaveBeenCalled();
  });
});
