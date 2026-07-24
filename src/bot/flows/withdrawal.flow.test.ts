import TelegramBot from "node-telegram-bot-api";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const balance = vi.fn();
const newWithdrawalRequests = vi.fn();
vi.mock("../../services/bot/transactions.service", () => ({
  TransactionsService: {
    balance: (...args: unknown[]) => balance(...args),
    newWithdrawalRequests: (...args: unknown[]) => newWithdrawalRequests(...args),
  },
}));

import { sessionService, BotSession } from "../session.service";
import * as withdrawalFlow from "./withdrawal.flow";

/** `withdrawal.flow.ts`: coleta um valor limitado ao saldo, confirma por callback e cria a solicitação via `TransactionsService` (mockado, já testado em `transactions.service.test.ts`). */
describe("withdrawal.flow", () => {
  const stamp = Date.now();
  const userId = 936000000 + Number(String(stamp).slice(-6));
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
    balance.mockReset();
    newWithdrawalRequests.mockReset();
  });
  afterEach(async () => sessionService.clear(userId));

  it("start entra no fluxo de saque e mostra o saldo disponível", async () => {
    balance.mockResolvedValue(200);
    const bot = fakeBot();
    await withdrawalFlow.start(bot, chatId, userId);
    expect(await sessionService.get(userId)).toEqual({ flow: "withdrawal", step: "value", data: {} });
    expect(bot.sendMessage).toHaveBeenCalledWith(chatId, expect.stringContaining("200"), expect.anything());
  });

  describe("handleMessage", () => {
    it("valor com formato inválido: reprompta com o saldo, sem avançar", async () => {
      balance.mockResolvedValue(50);
      const bot = fakeBot();
      const session: BotSession = { flow: "withdrawal", step: "value", data: {} };

      await withdrawalFlow.handleMessage(bot, msg("abc"), session);

      expect(bot.sendMessage).toHaveBeenCalledWith(chatId, expect.stringContaining("Valor incorreto"));
    });

    it("valor acima do saldo: rejeita e não avança", async () => {
      balance.mockResolvedValue(50);
      const bot = fakeBot();
      const session: BotSession = { flow: "withdrawal", step: "value", data: {} };
      await sessionService.set(userId, session);

      await withdrawalFlow.handleMessage(bot, msg("100"), session);

      expect(bot.sendMessage).toHaveBeenCalledWith(chatId, expect.stringContaining("superior ao saldo"));
      expect((await sessionService.get(userId)).step).toBe("value");
    });

    it("valor válido: pede confirmação e avança para 'confirm'", async () => {
      balance.mockResolvedValue(200);
      const bot = fakeBot();
      const session: BotSession = { flow: "withdrawal", step: "value", data: {} };
      await sessionService.set(userId, session);

      await withdrawalFlow.handleMessage(bot, msg("150"), session);

      expect((await sessionService.get(userId)).step).toBe("confirm");
    });
  });

  describe("handleCallback", () => {
    it("confirmar com sim e saldo suficiente: cria a solicitação e limpa a sessão", async () => {
      balance.mockResolvedValue(200);
      newWithdrawalRequests.mockResolvedValue(undefined);
      const bot = fakeBot();
      await sessionService.enterFlow(userId, "withdrawal", "confirm", {});

      await withdrawalFlow.handleCallback(bot, query("choice=yes&for=confirm-withdrawal-value&value=150"));

      expect(newWithdrawalRequests).toHaveBeenCalledWith(userId, 150);
      expect(await sessionService.get(userId)).toEqual({ flow: null, step: null, data: {} });
      expect(bot.sendMessage).toHaveBeenCalledWith(chatId, expect.stringContaining("sendo analisado"), expect.anything());
    });

    it("confirmar com sim mas saldo caiu abaixo do valor: rejeita e volta ao passo 'value'", async () => {
      balance.mockResolvedValue(50);
      const bot = fakeBot();
      await sessionService.enterFlow(userId, "withdrawal", "confirm", {});

      await withdrawalFlow.handleCallback(bot, query("choice=yes&for=confirm-withdrawal-value&value=150"));

      expect(newWithdrawalRequests).not.toHaveBeenCalled();
      expect((await sessionService.get(userId)).step).toBe("value");
    });

    it("confirmar com sim e o service lança erro: mostra o erro", async () => {
      balance.mockResolvedValue(200);
      newWithdrawalRequests.mockRejectedValue(new Error("já existe uma solicitação"));
      const bot = fakeBot();
      await sessionService.enterFlow(userId, "withdrawal", "confirm", {});

      await withdrawalFlow.handleCallback(bot, query("choice=yes&for=confirm-withdrawal-value&value=150"));

      expect(bot.sendMessage).toHaveBeenCalledWith(chatId, expect.stringContaining("já existe uma solicitação"), expect.anything());
    });

    it("confirmar com não: volta ao passo 'value'", async () => {
      const bot = fakeBot();
      await sessionService.enterFlow(userId, "withdrawal", "confirm", {});

      await withdrawalFlow.handleCallback(bot, query("choice=no&for=confirm-withdrawal-value&value=150"));

      expect(newWithdrawalRequests).not.toHaveBeenCalled();
      expect((await sessionService.get(userId)).step).toBe("value");
    });

    it("callback de outro contexto: ignora", async () => {
      const bot = fakeBot();
      await withdrawalFlow.handleCallback(bot, query("choice=yes&for=outro-contexto"));
      expect(newWithdrawalRequests).not.toHaveBeenCalled();
    });
  });
});
