import TelegramBot from "node-telegram-bot-api";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const existingUser = vi.fn();
vi.mock("../../services/bot/auth.service", () => ({
  AuthenticationService: { existingUser: (...args: unknown[]) => existingUser(...args) },
}));

const balance = vi.fn();
const transfersBetweenUsers = vi.fn();
vi.mock("../../services/bot/transactions.service", () => ({
  TransactionsService: {
    balance: (...args: unknown[]) => balance(...args),
    transfersBetweenUsers: (...args: unknown[]) => transfersBetweenUsers(...args),
  },
}));

import { sessionService, BotSession } from "../session.service";
import * as transferFlow from "./transfer.flow";

/** `transfer.flow.ts`: coleta valor + e-mail do destinatário, confirma por callback. `AuthenticationService`/`TransactionsService` mockados, já testados em seus próprios arquivos. */
describe("transfer.flow", () => {
  const stamp = Date.now();
  const userId = 937000000 + Number(String(stamp).slice(-6));
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
    existingUser.mockReset();
    balance.mockReset();
    transfersBetweenUsers.mockReset();
  });
  afterEach(async () => sessionService.clear(userId));

  it("start entra no fluxo de transferência e pede o valor", async () => {
    const bot = fakeBot();
    await transferFlow.start(bot, chatId, userId);
    expect(await sessionService.get(userId)).toEqual({ flow: "transfer", step: "value", data: {} });
  });

  describe("handleMessage — passo 'value'", () => {
    it("valor com formato inválido: reprompta", async () => {
      const bot = fakeBot();
      const session: BotSession = { flow: "transfer", step: "value", data: {} };

      await transferFlow.handleMessage(bot, msg("abc"), session);

      expect(bot.sendMessage).toHaveBeenCalledWith(chatId, expect.stringContaining("Valor incorreto"));
    });

    it("valor acima do saldo: rejeita", async () => {
      balance.mockResolvedValue(50);
      const bot = fakeBot();
      const session: BotSession = { flow: "transfer", step: "value", data: {} };

      await transferFlow.handleMessage(bot, msg("100"), session);

      expect(bot.sendMessage).toHaveBeenCalledWith(chatId, expect.stringContaining("superior ao saldo"));
    });

    it("valor válido: avança para o passo 'email'", async () => {
      balance.mockResolvedValue(200);
      const bot = fakeBot();
      const session: BotSession = { flow: "transfer", step: "value", data: {} };
      await sessionService.set(userId, session);

      await transferFlow.handleMessage(bot, msg("100"), session);

      const next = await sessionService.get(userId);
      expect(next.step).toBe("email");
      expect((next.data as any).value).toBe("100");
    });
  });

  describe("handleMessage — passo 'email'", () => {
    it("destinatário existente: pede confirmação e avança para 'confirm'", async () => {
      existingUser.mockResolvedValue({ id: 2 });
      const bot = fakeBot();
      const session: BotSession = { flow: "transfer", step: "email", data: { value: "100" } };
      await sessionService.set(userId, session);

      await transferFlow.handleMessage(bot, msg("dest@test.com"), session);

      expect(existingUser).toHaveBeenCalledWith("dest@test.com", String(userId));
      const next = await sessionService.get(userId);
      expect(next.step).toBe("confirm");
      expect((next.data as any).email).toBe("dest@test.com");
    });

    it("destinatário inexistente: mostra o erro e permanece no passo 'email'", async () => {
      existingUser.mockRejectedValue(new Error("Usuário não encontrado"));
      const bot = fakeBot();
      const session: BotSession = { flow: "transfer", step: "email", data: { value: "100" } };
      await sessionService.set(userId, session);

      await transferFlow.handleMessage(bot, msg("naoexiste@test.com"), session);

      expect(bot.sendMessage).toHaveBeenCalledWith(chatId, expect.stringContaining("Usuário não encontrado"));
      expect(await sessionService.get(userId)).toEqual(session);
    });
  });

  describe("handleCallback", () => {
    const confirmSession: BotSession = { flow: "transfer", step: "confirm", data: { value: "100", email: "dest@test.com" } };

    it("confirmar: transfere e limpa a sessão", async () => {
      transfersBetweenUsers.mockResolvedValue("Transferência concluída com sucesso!");
      const bot = fakeBot();

      await transferFlow.handleCallback(bot, query("choice=confirm&for=confirm-transfer-infos"), confirmSession);

      expect(transfersBetweenUsers).toHaveBeenCalledWith(100, userId, "dest@test.com");
      expect(bot.sendMessage).toHaveBeenCalledWith(chatId, "Transferência concluída com sucesso!", { parse_mode: "Markdown" });
      expect(await sessionService.get(userId)).toEqual({ flow: null, step: null, data: {} });
    });

    it("confirmar com erro do service: mostra o erro", async () => {
      transfersBetweenUsers.mockRejectedValue(new Error("saldo insuficiente"));
      const bot = fakeBot();

      await transferFlow.handleCallback(bot, query("choice=confirm&for=confirm-transfer-infos"), confirmSession);

      expect(bot.sendMessage).toHaveBeenCalledWith(chatId, expect.stringContaining("saldo insuficiente"), expect.anything());
    });

    it("cancelar: volta ao passo 'value' com os dados limpos", async () => {
      const bot = fakeBot();
      await sessionService.set(userId, confirmSession);

      await transferFlow.handleCallback(bot, query("choice=cancel&for=confirm-transfer-infos"), confirmSession);

      expect(transfersBetweenUsers).not.toHaveBeenCalled();
      expect(await sessionService.get(userId)).toEqual({ flow: "transfer", step: "value", data: {} });
    });

    it("callback de outro contexto: ignora", async () => {
      const bot = fakeBot();
      await transferFlow.handleCallback(bot, query("choice=confirm&for=outro-contexto"), confirmSession);
      expect(transfersBetweenUsers).not.toHaveBeenCalled();
    });
  });
});
