import TelegramBot from "node-telegram-bot-api";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const products = vi.fn();
vi.mock("../../services/bot/products.service", () => ({
  ProductsService: { products: (...args: unknown[]) => products(...args) },
}));

const request = vi.fn();
vi.mock("../../services/bot/requests.service", () => ({
  RequestsService: { request: (...args: unknown[]) => request(...args) },
}));

const balance = vi.fn();
const subscriptionWithBalance = vi.fn();
vi.mock("../../services/bot/transactions.service", () => ({
  TransactionsService: {
    balance: (...args: unknown[]) => balance(...args),
    subscriptionWithBalance: (...args: unknown[]) => subscriptionWithBalance(...args),
  },
}));

const generatePaymentLink = vi.fn();
vi.mock("../payment-link", () => ({
  generatePaymentLink: (...args: unknown[]) => generatePaymentLink(...args),
}));

import { sessionService, BotSession } from "../session.service";
import * as productsFlow from "./products.flow";

const AUTO_PLAN = { id: 1, description: "Plano Automático", price: "100.00", purchaseType: "auto" };
const MANUAL_PLAN = { id: 2, description: "Serviço Manual", price: "50.00", purchaseType: "manual" };

/**
 * `products.flow.ts`: lista planos, confirma escolha e decide entre saldo,
 * link de pagamento ou solicitação manual conforme `purchaseType`. Serviços
 * mockados já têm cobertura própria; `generatePaymentLink` também (em
 * `payment-link.test.ts`).
 */
describe("products.flow", () => {
  const stamp = Date.now();
  const userId = 938000000 + Number(String(stamp).slice(-6));
  const chatId = 1;

  function fakeBot(): TelegramBot {
    return { sendMessage: vi.fn().mockResolvedValue({}) } as unknown as TelegramBot;
  }

  function query(data: string) {
    return { data, message: { chat: { id: chatId } }, from: { id: userId } } as any;
  }

  beforeEach(() => {
    products.mockReset();
    request.mockReset();
    balance.mockReset();
    subscriptionWithBalance.mockReset();
    generatePaymentLink.mockReset();
  });
  afterEach(async () => sessionService.clear(userId));

  it("start busca os planos e os lista com botão de compra", async () => {
    products.mockResolvedValue([AUTO_PLAN, MANUAL_PLAN]);
    const bot = fakeBot();

    await productsFlow.start(bot, chatId, userId);

    const session = await sessionService.get(userId);
    expect(session.flow).toBe("products");
    expect((session.data as any).plans).toEqual([AUTO_PLAN, MANUAL_PLAN]);
    expect(bot.sendMessage).toHaveBeenCalledWith(chatId, AUTO_PLAN.description, expect.anything());
    expect(bot.sendMessage).toHaveBeenCalledWith(chatId, MANUAL_PLAN.description, expect.anything());
  });

  describe("handleCallback — choose-plan", () => {
    it("índice válido: pede confirmação do plano escolhido", async () => {
      const bot = fakeBot();
      const session: BotSession = { flow: "products", step: null, data: { plans: [AUTO_PLAN, MANUAL_PLAN] } };

      await productsFlow.handleCallback(bot, query("choice=0&for=choose-plan"), session);

      const next = await sessionService.get(userId);
      expect((next.data as any).chosenPlanId).toBe(AUTO_PLAN.id);
      expect(bot.sendMessage).toHaveBeenCalledWith(chatId, "Confirma?", expect.anything());
    });

    it("índice inválido: ignora sem lançar", async () => {
      const bot = fakeBot();
      const session: BotSession = { flow: "products", step: null, data: { plans: [AUTO_PLAN] } };

      await productsFlow.handleCallback(bot, query("choice=99&for=choose-plan"), session);

      expect(bot.sendMessage).not.toHaveBeenCalled();
    });
  });

  describe("handleCallback — confirm-choose-plan", () => {
    it("recusar a confirmação: reinicia a listagem de planos", async () => {
      products.mockResolvedValue([AUTO_PLAN]);
      const bot = fakeBot();
      const session: BotSession = { flow: "products", step: "confirm", data: { plans: [AUTO_PLAN], chosenPlanId: AUTO_PLAN.id } };

      await productsFlow.handleCallback(bot, query("choice=no&for=confirm-choose-plan"), session);

      expect(bot.sendMessage).toHaveBeenCalledWith(chatId, AUTO_PLAN.description, expect.anything());
    });

    it("plano automático, sem saldo: gera link de pagamento pelo valor cheio", async () => {
      balance.mockResolvedValue(0);
      const bot = fakeBot();
      const session: BotSession = { flow: "products", step: "confirm", data: { plans: [AUTO_PLAN], chosenPlanId: AUTO_PLAN.id } };

      await productsFlow.handleCallback(bot, query("choice=yes&for=confirm-choose-plan"), session);

      expect(generatePaymentLink).toHaveBeenCalledWith(bot, chatId, userId, 100, AUTO_PLAN);
      expect(await sessionService.get(userId)).toEqual({ flow: null, step: null, data: {} });
    });

    it("plano automático, saldo suficiente: oferece usar saldo ou gerar link", async () => {
      balance.mockResolvedValue(150);
      const bot = fakeBot();
      const session: BotSession = { flow: "products", step: "confirm", data: { plans: [AUTO_PLAN], chosenPlanId: AUTO_PLAN.id } };

      await productsFlow.handleCallback(bot, query("choice=yes&for=confirm-choose-plan"), session);

      expect(bot.sendMessage).toHaveBeenCalledWith(
        chatId,
        expect.stringContaining("suficiente para cobrir o custo"),
        expect.objectContaining({
          reply_markup: {
            inline_keyboard: [
              [
                { text: "Utilizar Saldo", callback_data: "choice=balance&for=choose-balance-link" },
                { text: "Gerar Link de Pagamento", callback_data: "choice=link&for=choose-balance-link" },
              ],
            ],
          },
        }),
      );
      expect(generatePaymentLink).not.toHaveBeenCalled();
    });

    it("plano automático, saldo parcial: oferece depósito ou gerar link", async () => {
      balance.mockResolvedValue(30);
      const bot = fakeBot();
      const session: BotSession = { flow: "products", step: "confirm", data: { plans: [AUTO_PLAN], chosenPlanId: AUTO_PLAN.id } };

      await productsFlow.handleCallback(bot, query("choice=yes&for=confirm-choose-plan"), session);

      expect(bot.sendMessage).toHaveBeenCalledWith(
        chatId,
        expect.stringContaining("suficiente para cobrir parte do custo"),
        expect.objectContaining({
          reply_markup: {
            inline_keyboard: [
              [
                { text: "Realizar Depósito", callback_data: "choice=deposit&for=choose-balance-link" },
                { text: "Gerar Link de Pagamento", callback_data: "choice=link&for=choose-balance-link" },
              ],
            ],
          },
        }),
      );
      expect(generatePaymentLink).not.toHaveBeenCalled();
    });

    it("plano manual, sucesso: registra a solicitação e limpa a sessão", async () => {
      request.mockResolvedValue(undefined);
      const bot = fakeBot();
      const session: BotSession = { flow: "products", step: "confirm", data: { plans: [MANUAL_PLAN], chosenPlanId: MANUAL_PLAN.id } };

      await productsFlow.handleCallback(bot, query("choice=yes&for=confirm-choose-plan"), session);

      expect(request).toHaveBeenCalledWith("service", userId, String(MANUAL_PLAN.id));
      expect(await sessionService.get(userId)).toEqual({ flow: null, step: null, data: {} });
      expect(bot.sendMessage).toHaveBeenCalledWith(chatId, expect.stringContaining("sucesso"), expect.anything());
    });

    it("plano manual, erro do service: mostra o erro", async () => {
      request.mockRejectedValue(new Error("falha no pedido"));
      const bot = fakeBot();
      const session: BotSession = { flow: "products", step: "confirm", data: { plans: [MANUAL_PLAN], chosenPlanId: MANUAL_PLAN.id } };

      await productsFlow.handleCallback(bot, query("choice=yes&for=confirm-choose-plan"), session);

      expect(bot.sendMessage).toHaveBeenCalledWith(chatId, expect.stringContaining("falha no pedido"), expect.anything());
    });
  });

  describe("handleCallback — choose-balance-link", () => {
    const session: BotSession = { flow: "products", step: "confirm", data: { plans: [AUTO_PLAN], chosenPlanId: AUTO_PLAN.id } };

    it("link: gera link de pagamento pelo valor cheio", async () => {
      const bot = fakeBot();
      await productsFlow.handleCallback(bot, query("choice=link&for=choose-balance-link"), session);
      expect(generatePaymentLink).toHaveBeenCalledWith(bot, chatId, userId, 100, AUTO_PLAN);
    });

    it("deposit: gera link de pagamento só pelo valor restante", async () => {
      balance.mockResolvedValue(30);
      const bot = fakeBot();
      await productsFlow.handleCallback(bot, query("choice=deposit&for=choose-balance-link"), session);
      expect(generatePaymentLink).toHaveBeenCalledWith(bot, chatId, userId, 70);
    });

    it("balance com sucesso: assina usando o saldo", async () => {
      subscriptionWithBalance.mockResolvedValue(undefined);
      const bot = fakeBot();
      await productsFlow.handleCallback(bot, query("choice=balance&for=choose-balance-link"), session);
      expect(subscriptionWithBalance).toHaveBeenCalledWith(userId, AUTO_PLAN);
      expect(bot.sendMessage).toHaveBeenCalledWith(chatId, expect.stringContaining("sucesso"), expect.anything());
    });

    it("balance com erro do service: mostra o erro", async () => {
      subscriptionWithBalance.mockRejectedValue(new Error("saldo insuficiente"));
      const bot = fakeBot();
      await productsFlow.handleCallback(bot, query("choice=balance&for=choose-balance-link"), session);
      expect(bot.sendMessage).toHaveBeenCalledWith(chatId, expect.stringContaining("saldo insuficiente"), expect.anything());
    });
  });
});
