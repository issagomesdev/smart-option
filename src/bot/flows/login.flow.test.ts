import TelegramBot from "node-telegram-bot-api";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const login = vi.fn();
vi.mock("../../services/bot/auth.service", () => ({
  AuthenticationService: { login: (...args: unknown[]) => login(...args) },
}));

const sendVerificationEmail = vi.fn();
vi.mock("../../services/bot/register.service", () => ({
  RegisterService: { sendVerificationEmail: (...args: unknown[]) => sendVerificationEmail(...args) },
}));

import { sessionService, BotSession } from "../session.service";
import * as loginFlow from "./login.flow";

/**
 * `login.flow.ts`: coleta email/senha em duas mensagens, confirma por
 * callback e autentica via `AuthenticationService.login` (mockado, já
 * testado em `auth.service.test.ts`). `sessionService` roda contra o Redis
 * real.
 */
describe("login.flow", () => {
  const stamp = Date.now();
  const userId = 931000000 + Number(String(stamp).slice(-6));
  const chatId = 1;

  function fakeBot(): TelegramBot {
    return { sendMessage: vi.fn().mockResolvedValue({}) } as unknown as TelegramBot;
  }

  beforeEach(() => {
    login.mockReset();
    sendVerificationEmail.mockReset();
  });

  afterEach(async () => {
    await sessionService.clear(userId);
  });

  it("start entra no fluxo de login no passo 'email' e pede o email", async () => {
    const bot = fakeBot();
    await loginFlow.start(bot, chatId, userId);

    expect(await sessionService.get(userId)).toEqual({ flow: "login", step: "email", data: {} });
    expect(bot.sendMessage).toHaveBeenLastCalledWith(chatId, "Email:");
  });

  describe("handleMessage", () => {
    it("passo 'email': grava o email e pede a senha", async () => {
      const bot = fakeBot();
      const session: BotSession = { flow: "login", step: "email", data: {} };

      await loginFlow.handleMessage(bot, { text: "user@test.com", from: { id: userId }, chat: { id: chatId } } as any, session);

      expect(await sessionService.get(userId)).toEqual({ flow: "login", step: "password", data: { email: "user@test.com" } });
      expect(bot.sendMessage).toHaveBeenCalledWith(chatId, "Senha:");
    });

    it("passo 'password': grava a senha e pede confirmação", async () => {
      const bot = fakeBot();
      const session: BotSession = { flow: "login", step: "password", data: { email: "user@test.com" } };

      await loginFlow.handleMessage(bot, { text: "senha123", from: { id: userId }, chat: { id: chatId } } as any, session);

      expect(await sessionService.get(userId)).toEqual({
        flow: "login",
        step: "confirm",
        data: { email: "user@test.com", password: "senha123" },
      });
      expect(bot.sendMessage).toHaveBeenCalledWith(
        chatId,
        expect.stringContaining("user@test.com"),
        expect.objectContaining({ reply_markup: expect.anything() }),
      );
    });
  });

  describe("handleCallback", () => {
    const confirmSession: BotSession = { flow: "login", step: "confirm", data: { email: "user@test.com", password: "senha123" } };

    function query(data: string) {
      return { data, message: { chat: { id: chatId } }, from: { id: userId } } as any;
    }

    it("confirmar login com sucesso: autentica, limpa a sessão e mostra o menu principal", async () => {
      login.mockResolvedValue({ id: userId, name: "Fulano" });
      const bot = fakeBot();

      await loginFlow.handleCallback(bot, query("choice=enter&for=confirm-login-infos"), confirmSession);

      expect(login).toHaveBeenCalledWith("user@test.com", "senha123", userId);
      expect(bot.sendMessage).toHaveBeenCalledWith(chatId, expect.stringContaining("Fulano"), { parse_mode: "Markdown" });
      expect(await sessionService.get(userId)).toEqual({ flow: null, step: null, data: {} });
    });

    it("confirmar login com email não validado: oferece reenvio, sem limpar a sessão", async () => {
      login.mockRejectedValue(new Error("Email não validado"));
      const bot = fakeBot();
      await sessionService.set(userId, confirmSession);

      await loginFlow.handleCallback(bot, query("choice=enter&for=confirm-login-infos"), confirmSession);

      expect(bot.sendMessage).toHaveBeenCalledWith(
        chatId,
        expect.stringContaining("não foi validado"),
        expect.objectContaining({ reply_markup: expect.anything() }),
      );
      expect(await sessionService.get(userId)).toEqual(confirmSession);
    });

    it("confirmar login com erro genérico: mostra o erro e reinicia o fluxo de login", async () => {
      login.mockRejectedValue(new Error("Credenciais inválidas"));
      const bot = fakeBot();

      await loginFlow.handleCallback(bot, query("choice=enter&for=confirm-login-infos"), confirmSession);

      expect(bot.sendMessage).toHaveBeenCalledWith(chatId, expect.stringContaining("Credenciais inválidas"), expect.anything());
      expect(await sessionService.get(userId)).toEqual({ flow: "login", step: "email", data: {} });
    });

    it("reenviar validação com sucesso", async () => {
      sendVerificationEmail.mockResolvedValue(undefined);
      const bot = fakeBot();

      await loginFlow.handleCallback(bot, query("choice=enter&for=resend-validation"), confirmSession);

      expect(sendVerificationEmail).toHaveBeenCalledWith("user@test.com");
      expect(bot.sendMessage).toHaveBeenCalledWith(chatId, expect.stringContaining("reenviado com sucesso"), expect.anything());
    });

    it("reenviar validação com erro: mostra o erro e reinicia o fluxo de login", async () => {
      sendVerificationEmail.mockRejectedValue(new Error("Falha ao enviar e-mail"));
      const bot = fakeBot();

      await loginFlow.handleCallback(bot, query("choice=enter&for=resend-validation"), confirmSession);

      expect(bot.sendMessage).toHaveBeenCalledWith(chatId, expect.stringContaining("Falha ao enviar e-mail"), expect.anything());
      expect(await sessionService.get(userId)).toEqual({ flow: "login", step: "email", data: {} });
    });
  });
});
