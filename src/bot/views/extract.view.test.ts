import TelegramBot from "node-telegram-bot-api";
import { beforeEach, describe, expect, it, vi } from "vitest";

const extract = vi.fn();
const checkoutsRequests = vi.fn();
const withdrawalRequests = vi.fn();
vi.mock("../../services/bot/transactions.service", () => ({
  TransactionsService: {
    extract: (...args: unknown[]) => extract(...args),
    checkoutsRequests: (...args: unknown[]) => checkoutsRequests(...args),
    withdrawalRequests: (...args: unknown[]) => withdrawalRequests(...args),
  },
}));

import { showExtract, showDepositRequests, showWithdrawalRequests, showSubscriptionRequests } from "./extract.view";

describe("extract.view", () => {
  const chatId = 1;
  const userId = 123;

  function fakeBot(): TelegramBot {
    return { sendMessage: vi.fn().mockResolvedValue({}) } as unknown as TelegramBot;
  }

  beforeEach(() => {
    extract.mockReset();
    checkoutsRequests.mockReset();
    withdrawalRequests.mockReset();
  });

  describe("showExtract", () => {
    it("monta a tabela do extrato", async () => {
      extract.mockResolvedValue([{ type: "sum", value: "100.00", origin: "deposit", reference_id: null, created_at: new Date() }]);
      const bot = fakeBot();

      await showExtract(bot, chatId, userId);

      expect(bot.sendMessage).toHaveBeenCalledWith(chatId, expect.stringContaining("EXTRATO"), { parse_mode: "HTML" });
    });

    it("traduz cada origem conhecida do extrato (bônus, saque, transferência, taxas etc.)", async () => {
      extract.mockResolvedValue([
        { type: "sum", value: "10.00", origin: "deposit", reference_id: null, created_at: new Date() },
        { type: "subtract", value: "5.00", origin: "withdrawal", reference_id: null, created_at: new Date() },
        { type: "sum", value: "3.00", origin: "earnings", reference_id: null, created_at: new Date() },
        { type: "sum", value: "2.00", origin: "profitability", reference_id: "7", created_at: new Date() },
        { type: "subtract", value: "1.00", origin: "transfer", reference_id: "8", created_at: new Date() },
        { type: "sum", value: "50.00", origin: "admin", reference_id: null, created_at: new Date() },
        { type: "subtract", value: "1.50", origin: "diamond_tax", reference_id: null, created_at: new Date() },
        { type: "sum", value: "20.00", origin: "subscription", reference_id: "9", created_at: new Date() },
        { type: "subtract", value: "20.00", origin: "subscription", reference_id: null, created_at: new Date() },
        { type: "sum", value: "15.00", origin: "tuition", reference_id: "10", created_at: new Date() },
        { type: "subtract", value: "15.00", origin: "tuition", reference_id: null, created_at: new Date() },
        { type: "sum", value: "1.00", origin: "algo_desconhecido", reference_id: null, created_at: new Date() },
      ]);
      const bot = fakeBot();

      await showExtract(bot, chatId, userId);

      const [, message] = (bot.sendMessage as any).mock.calls[0];
      for (const expected of ["Saque", "Rentabilidade", "B.R.#7", "Transf#8", "Transf#ADM", "Taxa Diamante", "B.A.#9", "Adesão", "B.M.#10", "Mensalidade", "Outros"]) {
        expect(message).toContain(expected);
      }
    });

    it("erro do service: mostra o erro", async () => {
      extract.mockRejectedValue(new Error("falha no extrato"));
      const bot = fakeBot();

      await showExtract(bot, chatId, userId);

      expect(bot.sendMessage).toHaveBeenCalledWith(chatId, expect.stringContaining("falha no extrato"), expect.anything());
    });
  });

  describe("showDepositRequests", () => {
    it("monta a tabela de depósitos com o status traduzido", async () => {
      checkoutsRequests.mockResolvedValue([{ value: "100.00", status: "PAID", created_at: new Date() }]);
      const bot = fakeBot();

      await showDepositRequests(bot, chatId, userId);

      expect(checkoutsRequests).toHaveBeenCalledWith(userId, "deposit");
      expect(bot.sendMessage).toHaveBeenCalledWith(chatId, expect.stringContaining("Concluído"), { parse_mode: "HTML" });
    });

    it("erro do service: mostra o erro", async () => {
      checkoutsRequests.mockRejectedValue(new Error("falha nos depósitos"));
      const bot = fakeBot();

      await showDepositRequests(bot, chatId, userId);

      expect(bot.sendMessage).toHaveBeenCalledWith(chatId, expect.stringContaining("falha nos depósitos"), expect.anything());
    });
  });

  describe("showWithdrawalRequests", () => {
    it("monta a tabela de saques com o status traduzido", async () => {
      withdrawalRequests.mockResolvedValue([{ value: "50.00", status: "success", created_at: new Date() }]);
      const bot = fakeBot();

      await showWithdrawalRequests(bot, chatId, userId);

      expect(bot.sendMessage).toHaveBeenCalledWith(chatId, expect.stringContaining("Concluído"), { parse_mode: "HTML" });
    });

    it("erro do service: mostra o erro", async () => {
      withdrawalRequests.mockRejectedValue(new Error("falha nos saques"));
      const bot = fakeBot();

      await showWithdrawalRequests(bot, chatId, userId);

      expect(bot.sendMessage).toHaveBeenCalledWith(chatId, expect.stringContaining("falha nos saques"), expect.anything());
    });
  });

  describe("showSubscriptionRequests", () => {
    it("monta a tabela de assinaturas com o nome do produto", async () => {
      checkoutsRequests.mockResolvedValue([{ name: "Bronze", status: "PENDING", created_at: new Date() }]);
      const bot = fakeBot();

      await showSubscriptionRequests(bot, chatId, userId);

      expect(checkoutsRequests).toHaveBeenCalledWith(userId, "subscription");
      expect(bot.sendMessage).toHaveBeenCalledWith(chatId, expect.stringContaining("Bronze"), { parse_mode: "HTML" });
    });

    it("erro do service: mostra o erro", async () => {
      checkoutsRequests.mockRejectedValue(new Error("falha nas assinaturas"));
      const bot = fakeBot();

      await showSubscriptionRequests(bot, chatId, userId);

      expect(bot.sendMessage).toHaveBeenCalledWith(chatId, expect.stringContaining("falha nas assinaturas"), expect.anything());
    });
  });
});
