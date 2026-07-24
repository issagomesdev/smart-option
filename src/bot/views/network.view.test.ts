import TelegramBot from "node-telegram-bot-api";
import { beforeEach, describe, expect, it, vi } from "vitest";

const affiliateNetwork = vi.fn();
vi.mock("../../services/bot/network.service", () => ({
  NetworkService: { affiliateNetwork: (...args: unknown[]) => affiliateNetwork(...args) },
}));

import { showNetwork } from "./network.view";

describe("showNetwork", () => {
  const chatId = 1;
  const userId = 123;

  function fakeBot(): TelegramBot {
    return { sendMessage: vi.fn().mockResolvedValue({}) } as unknown as TelegramBot;
  }

  beforeEach(() => {
    affiliateNetwork.mockReset();
  });

  it("monta a tabela de rede com os convidados ativos e inativos", async () => {
    affiliateNetwork.mockResolvedValue([
      { id: 1, name: "Fulano", level: 1, status: true },
      { id: 2, name: "Ciclano", level: 2, status: false },
    ]);
    const bot = fakeBot();

    await showNetwork(bot, chatId, userId);

    const [, message] = (bot.sendMessage as any).mock.calls[0];
    expect(message).toContain("Fulano");
    expect(message).toContain("Ativo");
    expect(message).toContain("Inativo");
  });

  it("erro do service: mostra o erro", async () => {
    affiliateNetwork.mockRejectedValue(new Error("falha ao buscar rede"));
    const bot = fakeBot();

    await showNetwork(bot, chatId, userId);

    expect(bot.sendMessage).toHaveBeenCalledWith(chatId, expect.stringContaining("falha ao buscar rede"), expect.anything());
  });
});
