import TelegramBot from "node-telegram-bot-api";
import { beforeEach, describe, expect, it, vi } from "vitest";

const isLoggedIn = vi.fn();
vi.mock("../../services/bot/auth.service", () => ({
  AuthenticationService: { isLoggedIn: (...args: unknown[]) => isLoggedIn(...args) },
}));

import { showAffiliateLink } from "./affiliate-link.view";

describe("showAffiliateLink", () => {
  const chatId = 1;
  const userId = 123;

  function fakeBot(): TelegramBot {
    return { sendMessage: vi.fn().mockResolvedValue({}) } as unknown as TelegramBot;
  }

  beforeEach(() => {
    isLoggedIn.mockReset();
  });

  it("usuário logado: envia o link de afiliado com o próprio id", async () => {
    isLoggedIn.mockResolvedValue({ id: userId });
    const bot = fakeBot();

    await showAffiliateLink(bot, chatId, userId);

    expect(bot.sendMessage).toHaveBeenCalledWith(chatId, expect.stringContaining(`start=${userId}`));
  });

  it("usuário não encontrado: mostra o erro", async () => {
    isLoggedIn.mockResolvedValue(null);
    const bot = fakeBot();

    await showAffiliateLink(bot, chatId, userId);

    expect(bot.sendMessage).toHaveBeenCalledWith(chatId, expect.stringContaining("Usuário não encontrado"), expect.anything());
  });
});
