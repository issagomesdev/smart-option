import TelegramBot from "node-telegram-bot-api";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const isLoggedIn = vi.fn();
vi.mock("../../services/bot/auth.service", () => ({
  AuthenticationService: { isLoggedIn: (...args: unknown[]) => isLoggedIn(...args) },
}));

import { authMenuKeyboard, mainMenuKeyboard, BACK } from "../keyboards";
import { sessionService, BotSession } from "../session.service";
import * as authFlow from "./auth.flow";

/**
 * `auth.flow.ts` é o roteador de fora-de-sessão (usuário ainda não logado):
 * decide entre mostrar o menu de autenticação, iniciar login/cadastro, ou
 * voltar ao menu certo dependendo de estar logado. `sessionService` roda
 * contra o Redis real (mesmo padrão de `session.service.test.ts`) — só
 * `AuthenticationService` é mockado, já testado em `auth.service.test.ts`.
 */
describe("auth.flow", () => {
  const stamp = Date.now();
  const userId = 930000000 + Number(String(stamp).slice(-6));
  const EMPTY_SESSION: BotSession = { flow: null, step: null, data: {} };

  function fakeBot(): TelegramBot {
    return {
      sendMessage: vi.fn().mockResolvedValue({}),
    } as unknown as TelegramBot;
  }

  beforeEach(() => {
    isLoggedIn.mockReset();
  });

  afterEach(async () => {
    await sessionService.clear(userId);
  });

  describe("isLoggedIn", () => {
    it("delega para AuthenticationService.isLoggedIn", async () => {
      isLoggedIn.mockResolvedValue({ id: userId });
      expect(await authFlow.isLoggedIn(userId)).toEqual({ id: userId });
      expect(isLoggedIn).toHaveBeenCalledWith(userId);
    });
  });

  describe("showAuthMenu", () => {
    it("envia o menu de autenticação", async () => {
      const bot = fakeBot();
      await authFlow.showAuthMenu(bot, 1);
      expect(bot.sendMessage).toHaveBeenCalledWith(1, expect.any(String), { reply_markup: authMenuKeyboard });
    });
  });

  describe("sendMainMenu", () => {
    it("envia o menu principal", async () => {
      const bot = fakeBot();
      await authFlow.sendMainMenu(bot, 1);
      expect(bot.sendMessage).toHaveBeenCalledWith(1, expect.any(String), { reply_markup: mainMenuKeyboard });
    });
  });

  describe("returnToAuthMenu", () => {
    it("limpa a sessão e mostra o menu principal se o usuário estiver logado", async () => {
      await sessionService.enterFlow(userId, "login", "email", {});
      isLoggedIn.mockResolvedValue({ id: userId });
      const bot = fakeBot();

      await authFlow.returnToAuthMenu(bot, 1, userId);

      expect(await sessionService.get(userId)).toEqual(EMPTY_SESSION);
      expect(bot.sendMessage).toHaveBeenCalledWith(1, expect.any(String), { reply_markup: mainMenuKeyboard });
    });

    it("limpa a sessão e mostra o menu de autenticação se o usuário não estiver logado", async () => {
      isLoggedIn.mockResolvedValue(null);
      const bot = fakeBot();

      await authFlow.returnToAuthMenu(bot, 1, userId);

      expect(bot.sendMessage).toHaveBeenCalledWith(1, expect.any(String), { reply_markup: authMenuKeyboard });
    });
  });

  describe("handleCommand", () => {
    it("🆕 CADASTRO inicia o fluxo de cadastro (delegando para register.flow.start)", async () => {
      const bot = fakeBot();
      await authFlow.handleCommand(bot, { text: "🆕 CADASTRO", from: { id: userId }, chat: { id: 1 } } as any, EMPTY_SESSION, null);

      const session = await sessionService.get(userId);
      expect(session.flow).toBe("register");
    });

    it("📲LOGIN inicia o fluxo de login (delegando para login.flow.start)", async () => {
      const bot = fakeBot();
      await authFlow.handleCommand(bot, { text: "📲LOGIN", from: { id: userId }, chat: { id: 1 } } as any, EMPTY_SESSION, null);

      const session = await sessionService.get(userId);
      expect(session).toEqual({ flow: "login", step: "email", data: {} });
    });

    it(`${BACK} volta ao menu de autenticação`, async () => {
      isLoggedIn.mockResolvedValue(null);
      const bot = fakeBot();
      await sessionService.enterFlow(userId, "login", "email", {});

      await authFlow.handleCommand(bot, { text: BACK, from: { id: userId }, chat: { id: 1 } } as any, EMPTY_SESSION, null);

      expect(await sessionService.get(userId)).toEqual(EMPTY_SESSION);
      expect(bot.sendMessage).toHaveBeenCalledWith(1, expect.any(String), { reply_markup: authMenuKeyboard });
    });

    it("comando não reconhecido com affiliateId presente inicia o cadastro com esse afiliado", async () => {
      const bot = fakeBot();
      await authFlow.handleCommand(bot, { text: "qualquer coisa", from: { id: userId }, chat: { id: 1 } } as any, EMPTY_SESSION, 555);

      const session = await sessionService.get(userId);
      expect(session.flow).toBe("register");
      expect((session.data as any).affiliateId).toBe(555);
    });

    it("comando não reconhecido sem afiliado e sem fluxo ativo mostra o menu de autenticação", async () => {
      const bot = fakeBot();
      await authFlow.handleCommand(bot, { text: "qualquer coisa", from: { id: userId }, chat: { id: 1 } } as any, EMPTY_SESSION, null);

      expect(bot.sendMessage).toHaveBeenCalledWith(1, expect.any(String), { reply_markup: authMenuKeyboard });
    });

    it("comando não reconhecido sem afiliado mas com um fluxo já em andamento não faz nada", async () => {
      const bot = fakeBot();
      const ongoing: BotSession = { flow: "login", step: "email", data: {} };

      await authFlow.handleCommand(bot, { text: "qualquer coisa", from: { id: userId }, chat: { id: 1 } } as any, ongoing, null);

      expect(bot.sendMessage).not.toHaveBeenCalled();
    });
  });
});
