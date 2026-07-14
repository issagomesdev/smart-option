import TelegramBot from "node-telegram-bot-api";
import { RequestsService } from "../../services/bot/requests.service";
import { sessionService, BotSession } from "../session.service";
import { backToMainMenuKeyboard } from "../keyboards";
import { sendError, sendSuccess } from "../ux";

export async function start(bot: TelegramBot, chatId: number, userId: number): Promise<void> {
  await sessionService.enterFlow(userId, "support", "message", {});
  await bot.sendMessage(chatId, "Olá, como podemos te ajudar hoje? Por favor, deixe uma única mensagem, de forma clara e direta sobre ao assunto que lhe trouxe aqui: ", {
    reply_markup: backToMainMenuKeyboard(),
  });
}

export async function handleMessage(bot: TelegramBot, msg: TelegramBot.Message, session: BotSession): Promise<void> {
  const chatId = msg.chat.id;
  const userId = msg.from!.id;

  if (session.step !== "message") return;

  try {
    await RequestsService.request("support", userId, msg.text ?? "");
    await sessionService.clear(userId);
    await sendSuccess(bot, chatId, "Solicitação de suporte recebida com sucesso. Em breve nossa equipe entrará em contato.");
  } catch (error: any) {
    await sendError(bot, chatId, error.message);
  }
}
