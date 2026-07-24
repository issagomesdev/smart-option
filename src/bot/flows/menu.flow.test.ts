import TelegramBot from "node-telegram-bot-api";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const logout = vi.fn();
const isLoggedIn = vi.fn();
vi.mock("../../services/bot/auth.service", () => ({
  AuthenticationService: {
    logout: (...args: unknown[]) => logout(...args),
    isLoggedIn: (...args: unknown[]) => isLoggedIn(...args),
  },
}));

const balance = vi.fn();
const hasWithdrawalPendingRequests = vi.fn();
const extract = vi.fn();
const checkoutsRequests = vi.fn();
const withdrawalRequests = vi.fn();
vi.mock("../../services/bot/transactions.service", () => ({
  TransactionsService: {
    balance: (...args: unknown[]) => balance(...args),
    hasWithdrawalPendingRequests: (...args: unknown[]) => hasWithdrawalPendingRequests(...args),
    extract: (...args: unknown[]) => extract(...args),
    checkoutsRequests: (...args: unknown[]) => checkoutsRequests(...args),
    withdrawalRequests: (...args: unknown[]) => withdrawalRequests(...args),
  },
}));

const products = vi.fn();
vi.mock("../../services/bot/products.service", () => ({
  ProductsService: { products: (...args: unknown[]) => products(...args) },
}));

const affiliateNetwork = vi.fn();
vi.mock("../../services/bot/network.service", () => ({
  NetworkService: { affiliateNetwork: (...args: unknown[]) => affiliateNetwork(...args) },
}));

import { financialMenuKeyboard, mainMenuKeyboard, BACK_TO_MAIN_MENU, BACK_TO_FINANCIAL_MENU } from "../keyboards";
import { sessionService, BotSession } from "../session.service";
import * as menuFlow from "./menu.flow";

/**
 * `menu.flow.ts` é o roteador central pós-login: um switch sobre o texto do
 * botão pressionado, despachando para o sub-fluxo certo. Cada ramo aqui
 * exercita o `start()` real do sub-fluxo correspondente (mesmo padrão de
 * injeção de `bot` usado em todo o `src/bot/flows`) — só a camada de serviço
 * (`AuthenticationService`/`TransactionsService`/`ProductsService`/
 * `NetworkService`, todas já testadas em seus próprios arquivos) é mockada.
 */
describe("menu.flow.handleCommand", () => {
  const stamp = Date.now();
  const userId = 933000000 + Number(String(stamp).slice(-6));
  const chatId = 1;
  const EMPTY_SESSION: BotSession = { flow: null, step: null, data: {} };

  function fakeBot(): TelegramBot {
    return { sendMessage: vi.fn().mockResolvedValue({}) } as unknown as TelegramBot;
  }

  function msg(text: string) {
    return { text, from: { id: userId }, chat: { id: chatId } } as any;
  }

  beforeEach(() => {
    logout.mockReset();
    isLoggedIn.mockReset();
    balance.mockReset().mockResolvedValue(0);
    hasWithdrawalPendingRequests.mockReset().mockResolvedValue(false);
    extract.mockReset().mockResolvedValue([]);
    checkoutsRequests.mockReset().mockResolvedValue([]);
    withdrawalRequests.mockReset().mockResolvedValue([]);
    products.mockReset().mockResolvedValue([]);
    affiliateNetwork.mockReset().mockResolvedValue([]);
  });

  afterEach(async () => {
    await sessionService.clear(userId);
  });

  it("PRODUTOS E SERVIÇOS: inicia o fluxo de produtos", async () => {
    const bot = fakeBot();
    await menuFlow.handleCommand(bot, msg("🎯 PRODUTOS E SERVIÇOS"), EMPTY_SESSION, { id: userId });
    expect((await sessionService.get(userId)).flow).toBe("products");
  });

  it("CADASTRO: inicia o cadastro de um indicado, com o próprio usuário como afiliado", async () => {
    const bot = fakeBot();
    await menuFlow.handleCommand(bot, msg("🪪 CADASTRO"), EMPTY_SESSION, { id: 777 });
    const session = await sessionService.get(userId);
    expect(session.flow).toBe("register");
    expect((session.data as any).affiliateId).toBe(777);
  });

  it("LINK DE AFILIADO: mostra o link do usuário logado", async () => {
    isLoggedIn.mockResolvedValue({ id: userId });
    const bot = fakeBot();
    await menuFlow.handleCommand(bot, msg("🔗 LINK DE AFILIADO"), EMPTY_SESSION, { id: userId });
    expect(bot.sendMessage).toHaveBeenCalledWith(chatId, expect.stringContaining("t.me/"));
  });

  it("SALDO: mostra o saldo atual formatado", async () => {
    balance.mockResolvedValue(123.4);
    const bot = fakeBot();
    await menuFlow.handleCommand(bot, msg("💰 SALDO"), EMPTY_SESSION, { id: userId });
    expect(bot.sendMessage).toHaveBeenCalledWith(chatId, expect.stringContaining("123,4"));
  });

  it("REDE: mostra a tabela de rede de afiliados", async () => {
    const bot = fakeBot();
    await menuFlow.handleCommand(bot, msg("🚻 REDE"), EMPTY_SESSION, { id: userId });
    expect(affiliateNetwork).toHaveBeenCalledWith(userId);
    expect(bot.sendMessage).toHaveBeenCalled();
  });

  it("FINANCEIRO: abre o menu financeiro", async () => {
    const bot = fakeBot();
    await menuFlow.handleCommand(bot, msg("💲FINANCEIRO"), EMPTY_SESSION, { id: userId });
    expect(bot.sendMessage).toHaveBeenCalledWith(chatId, expect.any(String), { reply_markup: financialMenuKeyboard });
  });

  it("DEPÓSITO: inicia o fluxo de depósito", async () => {
    const bot = fakeBot();
    await menuFlow.handleCommand(bot, msg("➕💵 DEPÓSITO"), EMPTY_SESSION, { id: userId });
    expect((await sessionService.get(userId)).flow).toBe("deposit");
  });

  it("SAQUE com pedido já pendente: avisa e não inicia o fluxo de saque", async () => {
    hasWithdrawalPendingRequests.mockResolvedValue(true);
    const bot = fakeBot();
    await menuFlow.handleCommand(bot, msg("➖💵 SAQUE"), EMPTY_SESSION, { id: userId });
    expect(bot.sendMessage).toHaveBeenCalledWith(chatId, expect.stringContaining("sendo analisado"), expect.anything());
    expect((await sessionService.get(userId)).flow).toBeNull();
  });

  it("SAQUE sem pedido pendente: inicia o fluxo de saque", async () => {
    hasWithdrawalPendingRequests.mockResolvedValue(false);
    const bot = fakeBot();
    await menuFlow.handleCommand(bot, msg("➖💵 SAQUE"), EMPTY_SESSION, { id: userId });
    expect((await sessionService.get(userId)).flow).toBe("withdrawal");
  });

  it("TRANSFERIR SALDO: inicia o fluxo de transferência", async () => {
    const bot = fakeBot();
    await menuFlow.handleCommand(bot, msg("💲🔄 TRANSFERIR SALDO"), EMPTY_SESSION, { id: userId });
    expect((await sessionService.get(userId)).flow).toBe("transfer");
  });

  it("EXTRATO: mostra o extrato", async () => {
    const bot = fakeBot();
    await menuFlow.handleCommand(bot, msg("🧾 EXTRATO"), EMPTY_SESSION, { id: userId });
    expect(extract).toHaveBeenCalledWith(userId);
  });

  it("SOLICITAÇÕES DE DEPÓSITO: lista os depósitos", async () => {
    const bot = fakeBot();
    await menuFlow.handleCommand(bot, msg("📥 SOLICITAÇÕES DE DEPÓSITO"), EMPTY_SESSION, { id: userId });
    expect(checkoutsRequests).toHaveBeenCalledWith(userId, "deposit");
  });

  it("SOLICITAÇÕES DE SAQUE: lista os saques", async () => {
    const bot = fakeBot();
    await menuFlow.handleCommand(bot, msg("📤 SOLICITAÇÕES DE SAQUE"), EMPTY_SESSION, { id: userId });
    expect(withdrawalRequests).toHaveBeenCalledWith(userId);
  });

  it("SOLICITAÇÕES DE ADESÃO: lista as assinaturas", async () => {
    const bot = fakeBot();
    await menuFlow.handleCommand(bot, msg("🛒 SOLICITAÇÕES DE ADESÃO"), EMPTY_SESSION, { id: userId });
    expect(checkoutsRequests).toHaveBeenCalledWith(userId, "subscription");
  });

  it("DÚVIDAS GERAIS: mostra as regras", async () => {
    const bot = fakeBot();
    await menuFlow.handleCommand(bot, msg("📃 DÚVIDAS GERAIS"), EMPTY_SESSION, { id: userId });
    expect(bot.sendMessage).toHaveBeenCalled();
  });

  it("ATENDIMENTO AO CLIENTE: inicia o fluxo de suporte", async () => {
    const bot = fakeBot();
    await menuFlow.handleCommand(bot, msg("📱 ATENDIMENTO AO CLIENTE"), EMPTY_SESSION, { id: userId });
    expect((await sessionService.get(userId)).flow).toBe("support");
  });

  it(`${BACK_TO_MAIN_MENU}: limpa a sessão e volta ao menu principal`, async () => {
    await sessionService.enterFlow(userId, "deposit", "value", {});
    const bot = fakeBot();
    await menuFlow.handleCommand(bot, msg(BACK_TO_MAIN_MENU), EMPTY_SESSION, { id: userId });
    expect(await sessionService.get(userId)).toEqual(EMPTY_SESSION);
    expect(bot.sendMessage).toHaveBeenCalledWith(chatId, expect.any(String), { reply_markup: mainMenuKeyboard });
  });

  it(`${BACK_TO_FINANCIAL_MENU}: limpa a sessão e volta ao menu financeiro`, async () => {
    await sessionService.enterFlow(userId, "deposit", "value", {});
    const bot = fakeBot();
    await menuFlow.handleCommand(bot, msg(BACK_TO_FINANCIAL_MENU), EMPTY_SESSION, { id: userId });
    expect(await sessionService.get(userId)).toEqual(EMPTY_SESSION);
    expect(bot.sendMessage).toHaveBeenCalledWith(chatId, expect.any(String), { reply_markup: financialMenuKeyboard });
  });

  it("SAIR DA CONTA: desloga, limpa a sessão e mostra o menu de autenticação", async () => {
    logout.mockResolvedValue(undefined);
    const bot = fakeBot();
    await menuFlow.handleCommand(bot, msg("🔚SAIR DA CONTA"), EMPTY_SESSION, { id: userId });
    expect(logout).toHaveBeenCalledWith(userId);
    expect(await sessionService.get(userId)).toEqual(EMPTY_SESSION);
    expect(bot.sendMessage).toHaveBeenCalled();
  });

  it("SAIR DA CONTA com erro: mostra o erro sem travar", async () => {
    logout.mockRejectedValue(new Error("falha ao deslogar"));
    const bot = fakeBot();
    await menuFlow.handleCommand(bot, msg("🔚SAIR DA CONTA"), EMPTY_SESSION, { id: userId });
    expect(bot.sendMessage).toHaveBeenCalledWith(chatId, expect.stringContaining("falha ao deslogar"), expect.anything());
  });

  it("comando não reconhecido: não faz nada", async () => {
    const bot = fakeBot();
    await menuFlow.handleCommand(bot, msg("qualquer coisa"), EMPTY_SESSION, { id: userId });
    expect(bot.sendMessage).not.toHaveBeenCalled();
  });
});
