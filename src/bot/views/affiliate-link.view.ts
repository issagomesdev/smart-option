import TelegramBot from "node-telegram-bot-api";
import { env } from "../../config/env";
import { AuthenticationService } from "../../services/bot/auth.service";
import { sendError } from "../ux";

export async function showAffiliateLink(bot: TelegramBot, chatId: number, userId: number): Promise<void> {
  const user = await AuthenticationService.isLoggedIn(userId);
  if (!user) {
    await sendError(bot, chatId, "Usuário não encontrado");
    return;
  }

  await bot.sendMessage(chatId, `https://t.me/${env.BOT_USER}?start=${encodeURIComponent(user.id)}`);
}
