import TelegramBot from "node-telegram-bot-api";
import { describe, expect, it, vi } from "vitest";

import { showRules } from "./rules.view";

describe("showRules", () => {
  it("envia todas as mensagens de regras em sequência", async () => {
    const bot = { sendMessage: vi.fn().mockResolvedValue({}) } as unknown as TelegramBot;

    await showRules(bot, 1);

    expect(bot.sendMessage).toHaveBeenCalledTimes(7);
    expect(bot.sendMessage).toHaveBeenCalledWith(1, expect.any(String), { parse_mode: "Markdown" });
  });
});
