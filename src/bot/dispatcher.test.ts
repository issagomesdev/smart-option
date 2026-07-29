import TelegramBot from "node-telegram-bot-api";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const isLoggedIn = vi.fn();
vi.mock("../services/bot/auth.service", () => ({
  AuthenticationService: { isLoggedIn: (...args: unknown[]) => isLoggedIn(...args) },
}));

const registerHandleMessage = vi.fn();
vi.mock("./flows/register.flow", () => ({
  handleMessage: (...args: unknown[]) => registerHandleMessage(...args),
  handleCallback: vi.fn(),
  start: vi.fn(),
}));

const depositHandleMessage = vi.fn();
vi.mock("./flows/deposit.flow", () => ({
  handleMessage: (...args: unknown[]) => depositHandleMessage(...args),
  handleCallback: vi.fn(),
  start: vi.fn(),
}));

import { sessionService, BotSession } from "./session.service";
import { BACK, BACK_TO_FINANCIAL_MENU, BACK_TO_MAIN_MENU } from "./keyboards";
import * as dispatcher from "./dispatcher";

/**
 * O dispatcher é a única camada que enxerga todos os fluxos ao mesmo tempo — é onde o botão de
 * voltar e a rede de segurança de erros precisam morar para valer em qualquer seção. Os fluxos de
 * cadastro e depósito são mockados só para provar o roteamento (eles têm suítes próprias);
 * `sessionService` roda contra o Redis real, igual às demais suítes do bot.
 */
describe("dispatcher", () => {
  const stamp = Date.now();
  const userId = 941000000 + Number(String(stamp).slice(-6));
  const chatId = 77;

  function fakeBot(): TelegramBot {
    return {
      sendMessage: vi.fn().mockResolvedValue({}),
      answerCallbackQuery: vi.fn().mockResolvedValue({}),
      sendChatAction: vi.fn().mockResolvedValue({}),
    } as unknown as TelegramBot;
  }

  function msg(text: string) {
    return { text, from: { id: userId }, chat: { id: chatId } } as unknown as TelegramBot.Message;
  }

  function sentText(bot: TelegramBot): string {
    return (bot.sendMessage as unknown as { mock: { calls: unknown[][] } }).mock.calls
      .map((call) => String(call[1]))
      .join(" | ");
  }

  beforeEach(() => {
    isLoggedIn.mockReset();
    registerHandleMessage.mockReset();
    depositHandleMessage.mockReset();
  });

  afterEach(async () => {
    await sessionService.clear(userId);
  });

  describe("botão de voltar", () => {
    it("no cadastro: sai do fluxo e volta ao menu de autenticação, sem entregar o rótulo ao fluxo", async () => {
      const session: BotSession = { flow: "register", step: "collecting", data: { answers: {}, currentField: 0 } };
      await sessionService.set(userId, session);
      isLoggedIn.mockResolvedValue(null);
      const bot = fakeBot();

      await dispatcher.handleMessage(bot, msg(BACK));

      // O bug era este: o fluxo ativo recebia "🔄 VOLTAR" como resposta do campo em edição.
      expect(registerHandleMessage).not.toHaveBeenCalled();
      expect(await sessionService.get(userId)).toEqual({ flow: null, step: null, data: {} });
      expect(sentText(bot)).toContain("Entre em sua conta");
    });

    it("num fluxo financeiro: volta ao menu financeiro, não ao menu principal", async () => {
      await sessionService.set(userId, { flow: "deposit", step: "amount", data: {} });
      isLoggedIn.mockResolvedValue({ id: 1 });
      const bot = fakeBot();

      await dispatcher.handleMessage(bot, msg(BACK_TO_FINANCIAL_MENU));

      expect(depositHandleMessage).not.toHaveBeenCalled();
      expect(sentText(bot)).toContain("menu financeiro");
    });

    it("num fluxo do menu principal: volta ao menu principal", async () => {
      await sessionService.set(userId, { flow: "support", step: "message", data: {} });
      isLoggedIn.mockResolvedValue({ id: 1 });
      const bot = fakeBot();

      await dispatcher.handleMessage(bot, msg(BACK_TO_MAIN_MENU));

      expect(sentText(bot)).toContain("menu principal");
    });

    it("de um fluxo financeiro sem sessão válida: cai no menu de autenticação, não numa tela inoperável", async () => {
      await sessionService.set(userId, { flow: "withdrawal", step: "amount", data: {} });
      isLoggedIn.mockResolvedValue(null);
      const bot = fakeBot();

      await dispatcher.handleMessage(bot, msg(BACK));

      expect(sentText(bot)).toContain("Entre em sua conta");
    });

    it("qualquer rótulo de voltar encerra qualquer fluxo — o usuário não precisa acertar o botão", async () => {
      for (const label of [BACK, BACK_TO_MAIN_MENU, BACK_TO_FINANCIAL_MENU]) {
        await sessionService.set(userId, { flow: "register", step: "collecting", data: {} });
        isLoggedIn.mockResolvedValue(null);

        await dispatcher.handleMessage(fakeBot(), msg(label));

        expect(await sessionService.get(userId)).toEqual({ flow: null, step: null, data: {} });
      }
      expect(registerHandleMessage).not.toHaveBeenCalled();
    });

    it("fora de um fluxo, o rótulo segue para o menu normalmente (não é engolido pelo dispatcher)", async () => {
      isLoggedIn.mockResolvedValue({ id: 1 });
      const bot = fakeBot();

      await dispatcher.handleMessage(bot, msg(BACK_TO_MAIN_MENU));

      expect(sentText(bot)).toContain("menu principal");
    });
  });

  describe("rede de segurança de erros", () => {
    it("erro cru de qualquer fluxo vira mensagem em português, sem SQL nem stack trace", async () => {
      await sessionService.set(userId, { flow: "register", step: "collecting", data: {} });
      registerHandleMessage.mockRejectedValue(
        new Error("Failed query: insert into `bot_users` ... params: fulano,f@x.com,$2b$12$hash"),
      );
      const bot = fakeBot();

      await dispatcher.handleMessage(bot, msg("Fulano"));

      const sent = sentText(bot);
      expect(sent).toContain("suporte");
      expect(sent).not.toContain("Failed query");
      expect(sent).not.toContain("bot_users");
      expect(sent).not.toContain("$2b$12$");
    });

    it("erro de negócio mantém a mensagem original, que já é escrita para o usuário", async () => {
      await sessionService.set(userId, { flow: "register", step: "collecting", data: {} });
      const { ValidationError } = await import("../shared/errors");
      registerHandleMessage.mockRejectedValue(new ValidationError("CPF inválido"));
      const bot = fakeBot();

      await dispatcher.handleMessage(bot, msg("123"));

      expect(sentText(bot)).toContain("CPF inválido");
    });

    it("uma falha no fluxo nunca deixa o usuário sem resposta", async () => {
      await sessionService.set(userId, { flow: "register", step: "collecting", data: {} });
      registerHandleMessage.mockRejectedValue(new Error("qualquer coisa"));
      const bot = fakeBot();

      await dispatcher.handleMessage(bot, msg("Fulano"));

      expect(bot.sendMessage).toHaveBeenCalled();
    });
  });
});
