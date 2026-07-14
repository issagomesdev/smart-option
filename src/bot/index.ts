import TelegramBot from "node-telegram-bot-api";
import { env } from "../config/env";
import { logger } from "../shared/logger";
import { sessionService, BotSession } from "./session.service";
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

export const bot = new TelegramBot(env.BOT_TOKEN, { polling: true });

const EMPTY_SESSION: BotSession = { flow: null, step: null, data: {} };

/**
 * Dispatcher único, persistente durante toda a vida do processo. Substitui o
 * antigo padrão de `bot.on()`/`bot.removeListener()` registrado e removido
 * dinamicamente por seção — que fazia listeners de um usuário processarem
 * mensagens de todos os outros usuários simultâneos (estado global) e
 * empilhava listeners duplicados sempre que um menu era reaberto. Aqui o
 * roteamento é 100% determinado por `SessionService` (Redis, por usuário),
 * então múltiplas conversas concorrentes nunca se cruzam.
 */
export async function start(): Promise<void> {
  bot.on("message", async (msg) => {
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
      logger.error({ err: error }, "Erro ao processar mensagem do bot");
    }
  });

  bot.on("callback_query", async (query) => {
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
      logger.error({ err: error }, "Erro ao processar callback do bot");
    }
  });

  bot.on("polling_error", (error) => {
    logger.error({ err: error }, "Erro de polling do bot");
  });

  logger.info("Bot Telegram iniciado");
}
