import TelegramBot from "node-telegram-bot-api";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const generatePaymentLink = vi.fn();
vi.mock("../payment-link", () => ({
  generatePaymentLink: (...args: unknown[]) => generatePaymentLink(...args),
}));

import { sessionService, BotSession } from "../session.service";
import * as depositFlow from "./deposit.flow";

/** `deposit.flow.ts`: coleta um valor, confirma por callback e delega para `generatePaymentLink` (mockado — tem seu próprio teste em `payment-link.test.ts`). */
describe("deposit.flow", () => {
  const stamp = Date.now();
  const userId = 935000000 + Number(String(stamp).slice(-6));
  const chatId = 1;

  function fakeBot(): TelegramBot {
    return { sendMessage: vi.fn().mockResolvedValue({}) } as unknown as TelegramBot;
  }

  function msg(text: string) {
    return { text, from: { id: userId }, chat: { id: chatId } } as any;
  }

  function query(data: string) {
    return { data, message: { chat: { id: chatId } }, from: { id: userId } } as any;
  }

  beforeEach(() => {
    generatePaymentLink.mockReset();
  });
  afterEach(async () => sessionService.clear(userId));

  it("start entra no fluxo de depósito e pede o valor", async () => {
    const bot = fakeBot();
    await depositFlow.start(bot, chatId, userId);
    expect(await sessionService.get(userId)).toEqual({ flow: "deposit", step: "value", data: {} });
  });

  describe("handleMessage", () => {
    it("valor com formato inválido: reprompta sem avançar", async () => {
      const bot = fakeBot();
      const session: BotSession = { flow: "deposit", step: "value", data: {} };

      await depositFlow.handleMessage(bot, msg("abc"), session);

      expect(bot.sendMessage).toHaveBeenCalledWith(chatId, expect.stringContaining("Valor incorreto"));
      expect(await sessionService.get(userId)).toEqual({ flow: null, step: null, data: {} });
    });

    it("valor válido: pede confirmação e avança para o passo 'confirm'", async () => {
      const bot = fakeBot();
      const session: BotSession = { flow: "deposit", step: "value", data: {} };
      await sessionService.set(userId, session);

      await depositFlow.handleMessage(bot, msg("150,50"), session);

      expect(bot.sendMessage).toHaveBeenCalledWith(chatId, expect.stringContaining("150,5"));
      expect((await sessionService.get(userId)).step).toBe("confirm");
    });

    it("ignora mensagens fora do passo 'value'", async () => {
      const bot = fakeBot();
      const session: BotSession = { flow: "deposit", step: "confirm", data: {} };

      await depositFlow.handleMessage(bot, msg("100"), session);

      expect(bot.sendMessage).not.toHaveBeenCalled();
    });
  });

  describe("handleCallback", () => {
    it("confirmar com sim: limpa a sessão e gera o link de pagamento", async () => {
      const bot = fakeBot();
      await sessionService.enterFlow(userId, "deposit", "confirm", {});

      await depositFlow.handleCallback(bot, query("choice=yes&for=confirm-deposit-value&value=100"));

      expect(generatePaymentLink).toHaveBeenCalledWith(bot, chatId, userId, 100);
      expect(await sessionService.get(userId)).toEqual({ flow: null, step: null, data: {} });
    });

    it("confirmar com não: pede o valor de novo", async () => {
      const bot = fakeBot();
      await sessionService.enterFlow(userId, "deposit", "confirm", {});

      await depositFlow.handleCallback(bot, query("choice=no&for=confirm-deposit-value&value=100"));

      expect(generatePaymentLink).not.toHaveBeenCalled();
      expect((await sessionService.get(userId)).step).toBe("value");
    });

    it("callback de outro contexto: ignora", async () => {
      const bot = fakeBot();
      await depositFlow.handleCallback(bot, query("choice=yes&for=outro-contexto"));
      expect(generatePaymentLink).not.toHaveBeenCalled();
    });
  });
});
