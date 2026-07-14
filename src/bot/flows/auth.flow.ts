import TelegramBot from "node-telegram-bot-api";
import { AuthenticationService } from "../../services/bot/auth.service";
import { sessionService, BotSession } from "../session.service";
import { authMenuKeyboard, mainMenuKeyboard, BACK } from "../keyboards";
import * as loginFlow from "./login.flow";
import * as registerFlow from "./register.flow";

export async function isLoggedIn(userId: number) {
  return AuthenticationService.isLoggedIn(userId);
}

export async function showAuthMenu(bot: TelegramBot, chatId: number): Promise<void> {
  await bot.sendMessage(chatId, "Entre em sua conta para continuar ou se ainda não possui uma conta cadastre-se agora", {
    reply_markup: authMenuKeyboard,
  });
}

export async function sendMainMenu(bot: TelegramBot, chatId: number): Promise<void> {
  await bot.sendMessage(
    chatId,
    'Para iniciar, clique no menu abaixo em "PRODUTOS E SERVIÇOS" para conhecer os planos mensais, serviços e produtos.',
    { reply_markup: mainMenuKeyboard },
  );
}

/** Sai de qualquer fluxo em andamento (login/cadastro) e volta ao menu apropriado. */
export async function returnToAuthMenu(bot: TelegramBot, chatId: number, userId: number): Promise<void> {
  await sessionService.clear(userId);
  const loggedInUser = await isLoggedIn(userId);
  if (loggedInUser) {
    await sendMainMenu(bot, chatId);
  } else {
    await showAuthMenu(bot, chatId);
  }
}

export async function handleCommand(
  bot: TelegramBot,
  msg: TelegramBot.Message,
  session: BotSession,
  affiliateId: number | null,
): Promise<void> {
  const chatId = msg.chat.id;
  const userId = msg.from!.id;

  switch (msg.text) {
    case "🆕 CADASTRO":
      await registerFlow.start(bot, chatId, userId, affiliateId);
      break;
    case "📲LOGIN":
      await loginFlow.start(bot, chatId, userId);
      break;
    case BACK:
      await returnToAuthMenu(bot, chatId, userId);
      break;
    default:
      if (affiliateId) {
        await registerFlow.start(bot, chatId, userId, affiliateId);
      } else if (!session.flow) {
        await showAuthMenu(bot, chatId);
      }
  }
}
