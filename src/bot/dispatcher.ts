import TelegramBot from "node-telegram-bot-api";
import { logger } from "../shared/logger";
import { sessionService, BotSession, BotFlow } from "./session.service";
import { BACK, BACK_TO_FINANCIAL_MENU, BACK_TO_MAIN_MENU } from "./keyboards";
import { replyWithError } from "./errors";
import { AuthenticationService } from "../services/bot/auth.service";
import * as authFlow from "./flows/auth.flow";
import * as loginFlow from "./flows/login.flow";
import * as registerFlow from "./flows/register.flow";
import * as menuFlow from "./flows/menu.flow";
import * as depositFlow from "./flows/deposit.flow";
import * as withdrawalFlow from "./flows/withdrawal.flow";
import * as transferFlow from "./flows/transfer.flow";
import * as productsFlow from "./flows/products.flow";
import * as supportFlow from "./flows/support.flow";

const EMPTY_SESSION: BotSession = { flow: null, step: null, data: {} };

/**
 * Seção "pai" de cada fluxo — para onde o botão de voltar leva.
 *
 * O tratamento do voltar precisa ser central, antes do roteamento por `session.flow`: enquanto um
 * fluxo está ativo, o dispatcher entrega toda mensagem de texto para ele, então o rótulo do botão
 * chegava como se fosse a resposta da pergunta corrente (bug real — apertar VOLTAR durante o
 * cadastro gravava "🔄 VOLTAR" no campo em edição e seguia para o próximo). Nenhum fluxo tratava o
 * rótulo, de modo que o `case BACK` de `auth.flow` só era alcançável fora de um fluxo.
 */
const FLOW_PARENT: Record<BotFlow, "auth" | "main" | "financial"> = {
  login: "auth",
  register: "auth",
  deposit: "financial",
  withdrawal: "financial",
  transfer: "financial",
  products: "main",
  support: "main",
};

const BACK_LABELS = new Set<string>([BACK, BACK_TO_MAIN_MENU, BACK_TO_FINANCIAL_MENU]);

/** Sai do fluxo atual e devolve o usuário à seção anterior, seja qual for o fluxo em andamento. */
export async function goBack(bot: TelegramBot, chatId: number, userId: number, flow: BotFlow): Promise<void> {
  // Voltar para um menu interno exige sessão válida; sem ela o lugar correto é o menu de
  // autenticação, não uma tela que o usuário não pode operar. `returnTo*` já limpam a sessão.
  const loggedInUser = await AuthenticationService.isLoggedIn(userId);
  if (!loggedInUser) {
    await authFlow.returnToAuthMenu(bot, chatId, userId);
    return;
  }

  if (FLOW_PARENT[flow] === "financial") {
    await menuFlow.returnToFinancialMenu(bot, chatId, userId);
    return;
  }

  await menuFlow.returnToMainMenu(bot, chatId, userId);
}

/**
 * Roteamento de mensagens de texto. Separado de `index.ts` porque lá o `TelegramBot` é
 * instanciado com `polling: true` no carregamento do módulo — importá-lo em teste abriria uma
 * conexão real com a API do Telegram. Aqui o bot chega por parâmetro, então o dispatcher é
 * exercitável com um dublê.
 */
export async function handleMessage(bot: TelegramBot, msg: TelegramBot.Message): Promise<void> {
  try {
    if (!msg.from || msg.text === undefined) return;

    const userId = msg.from.id;
    const chatId = msg.chat.id;

    if (/^\/start/.test(msg.text)) {
      await sessionService.clear(userId);
      const loggedInUser = await AuthenticationService.isLoggedIn(userId);
      if (loggedInUser) {
        await authFlow.sendMainMenu(bot, chatId);
      } else {
        const match = msg.text.match(/^\/start (.+)/);
        const affiliateId = match ? Number(match[1]) : null;
        await authFlow.handleCommand(bot, msg, EMPTY_SESSION, affiliateId);
      }
      return;
    }

    const session = await sessionService.get(userId);

    // Antes do roteamento por fluxo, de propósito: senão o fluxo ativo consome o rótulo do botão
    // como se fosse a resposta da pergunta corrente.
    if (session.flow && BACK_LABELS.has(msg.text)) {
      await goBack(bot, chatId, userId, session.flow);
      return;
    }

    switch (session.flow) {
      case "login":
        await loginFlow.handleMessage(bot, msg, session);
        return;
      case "register":
        await registerFlow.handleMessage(bot, msg, session);
        return;
      case "deposit":
        await depositFlow.handleMessage(bot, msg, session);
        return;
      case "withdrawal":
        await withdrawalFlow.handleMessage(bot, msg, session);
        return;
      case "transfer":
        await transferFlow.handleMessage(bot, msg, session);
        return;
      case "support":
        await supportFlow.handleMessage(bot, msg, session);
        return;
    }

    const loggedInUser = await AuthenticationService.isLoggedIn(userId);
    if (loggedInUser) {
      await menuFlow.handleCommand(bot, msg, session, loggedInUser);
    } else {
      await authFlow.handleCommand(bot, msg, session, null);
    }
  } catch (error) {
    // Rede de segurança de todos os fluxos: qualquer erro não tratado vira uma mensagem em
    // português. O log fica no servidor; o usuário nunca recebe stack trace nem SQL.
    await replyWithError(bot, msg.chat.id, error, { telegramUserId: msg.from?.id, text: msg.text });
  }
}

/** Roteamento dos botões inline. Mesma separação e mesma rede de segurança de `handleMessage`. */
export async function handleCallback(bot: TelegramBot, query: TelegramBot.CallbackQuery): Promise<void> {
  try {
    if (!query.from || !query.data) return;

    await bot.answerCallbackQuery(query.id).catch(() => {});

    const userId = query.from.id;
    const session = await sessionService.get(userId);

    switch (session.flow) {
      case "login":
        await loginFlow.handleCallback(bot, query, session);
        break;
      case "register":
        await registerFlow.handleCallback(bot, query, session);
        break;
      case "deposit":
        await depositFlow.handleCallback(bot, query);
        break;
      case "withdrawal":
        await withdrawalFlow.handleCallback(bot, query);
        break;
      case "transfer":
        await transferFlow.handleCallback(bot, query, session);
        break;
      case "products":
        await productsFlow.handleCallback(bot, query, session);
        break;
    }
  } catch (error) {
    const chatId = query.message?.chat.id;
    if (chatId === undefined) {
      logger.error({ err: error }, "Erro ao processar callback do bot, sem chat para responder");
      return;
    }
    await replyWithError(bot, chatId, error, { telegramUserId: query.from?.id, data: query.data });
  }
}
