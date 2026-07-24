import TelegramBot from "node-telegram-bot-api";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const request = vi.fn();
vi.mock("../../services/bot/requests.service", () => ({
  RequestsService: { request: (...args: unknown[]) => request(...args) },
}));

import { sessionService, BotSession } from "../session.service";
import * as supportFlow from "./support.flow";

/** `support.flow.ts`: uma única mensagem livre vira um ticket via `RequestsService.request` (mockado, já testado em `requests.service.test.ts`). */
describe("support.flow", () => {
  const stamp = Date.now();
  const userId = 934000000 + Number(String(stamp).slice(-6));
  const chatId = 1;

  function fakeBot(): TelegramBot {
    return { sendMessage: vi.fn().mockResolvedValue({}) } as unknown as TelegramBot;
  }

  beforeEach(() => {
    request.mockReset();
  });
  afterEach(async () => sessionService.clear(userId));

  it("start entra no fluxo de suporte e pede a mensagem", async () => {
    const bot = fakeBot();
    await supportFlow.start(bot, chatId, userId);
    expect(await sessionService.get(userId)).toEqual({ flow: "support", step: "message", data: {} });
  });

  it("handleMessage no passo certo: registra o ticket e limpa a sessão", async () => {
    request.mockResolvedValue(undefined);
    const bot = fakeBot();
    const session: BotSession = { flow: "support", step: "message", data: {} };

    await supportFlow.handleMessage(bot, { text: "preciso de ajuda", from: { id: userId }, chat: { id: chatId } } as any, session);

    expect(request).toHaveBeenCalledWith("support", userId, "preciso de ajuda");
    expect(await sessionService.get(userId)).toEqual({ flow: null, step: null, data: {} });
    expect(bot.sendMessage).toHaveBeenCalledWith(chatId, expect.stringContaining("sucesso"), expect.anything());
  });

  it("handleMessage com erro do service: mostra o erro sem limpar a sessão", async () => {
    request.mockRejectedValue(new Error("falha ao registrar"));
    const bot = fakeBot();
    const session: BotSession = { flow: "support", step: "message", data: {} };
    await sessionService.set(userId, session);

    await supportFlow.handleMessage(bot, { text: "oi", from: { id: userId }, chat: { id: chatId } } as any, session);

    expect(bot.sendMessage).toHaveBeenCalledWith(chatId, expect.stringContaining("falha ao registrar"), expect.anything());
    expect(await sessionService.get(userId)).toEqual(session);
  });

  it("handleMessage fora do passo 'message': ignora", async () => {
    const bot = fakeBot();
    const session: BotSession = { flow: "support", step: null, data: {} };

    await supportFlow.handleMessage(bot, { text: "oi", from: { id: userId }, chat: { id: chatId } } as any, session);

    expect(request).not.toHaveBeenCalled();
    expect(bot.sendMessage).not.toHaveBeenCalled();
  });
});
