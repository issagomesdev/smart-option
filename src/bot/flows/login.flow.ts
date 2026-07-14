import TelegramBot from "node-telegram-bot-api";
import { AuthenticationService } from "../../services/bot/auth.service";
import { RegisterService } from "../../services/bot/register.service";
import { sessionService, BotSession } from "../session.service";
import { backToAuthMenuKeyboard, inlineKeyboard } from "../keyboards";
import { sendError, sendSuccess, sendTyping } from "../ux";
import { sendMainMenu } from "./auth.flow";

interface LoginData {
  email?: string;
  password?: string;
}

export async function start(bot: TelegramBot, chatId: number, userId: number): Promise<void> {
  await sessionService.enterFlow(userId, "login", "email", {});
  await bot.sendMessage(chatId, "Para realizar login em nosso sistema, digite corretamente seu", {
    reply_markup: backToAuthMenuKeyboard(),
  });
  await bot.sendMessage(chatId, "Email:");
}

export async function handleMessage(bot: TelegramBot, msg: TelegramBot.Message, session: BotSession): Promise<void> {
  const chatId = msg.chat.id;
  const userId = msg.from!.id;
  const data = session.data as LoginData;

  if (session.step === "email") {
    await sessionService.set(userId, { flow: "login", step: "password", data: { ...data, email: msg.text } });
    await bot.sendMessage(chatId, "Senha:");
    return;
  }

  if (session.step === "password") {
    const next = { ...data, password: msg.text };
    await sessionService.set(userId, { flow: "login", step: "confirm", data: next });
    await bot.sendMessage(chatId, "Você está a um passo de realizar login com essas credenciais");
    await bot.sendMessage(
      chatId,
      `Email: ${next.email}\nSenha: ${next.password}`,
      inlineKeyboard([{ text: "Entrar", callback_data: "choice=enter&for=confirm-login-infos" }]),
    );
  }
}

export async function handleCallback(bot: TelegramBot, query: TelegramBot.CallbackQuery, session: BotSession): Promise<void> {
  const chatId = query.message!.chat.id;
  const userId = query.from.id;
  const params = new URLSearchParams(query.data ?? "");
  const data = session.data as LoginData;

  if (params.get("for") === "confirm-login-infos" && params.get("choice") === "enter") {
    await sendTyping(bot, chatId);
    try {
      const user = await AuthenticationService.login(data.email!, data.password!, userId);
      await bot.sendMessage(chatId, `Bem-vindo *${user.name}*!`, { parse_mode: "Markdown" });
      await sessionService.clear(userId);
      await sendMainMenu(bot, chatId);
    } catch (error: any) {
      if (error.message === "Email não validado") {
        await bot.sendMessage(
          chatId,
          "⚠ Parece que seu e-mail ainda não foi validado. Por favor, verifique a caixa de entrada do e-mail associado à sua conta no momento do registro, abra o e-mail enviado e clique no link fornecido para ativar sua conta. Se você não conseguir encontrá-lo, verifique sua pasta de spam ou clique em reenviar validação para receber outro email. Se ainda estiver enfrentando problemas após isso, entre em contato conosco para obter assistência",
          inlineKeyboard([{ text: "Reenviar Validação", callback_data: "choice=enter&for=resend-validation" }]),
        );
      } else {
        await sendError(bot, chatId, error.message);
        await start(bot, chatId, userId);
      }
    }
    return;
  }

  if (params.get("for") === "resend-validation" && params.get("choice") === "enter") {
    try {
      await sendTyping(bot, chatId);
      await RegisterService.sendVerificationEmail(data.email!);
      await sendSuccess(bot, chatId, "Email de validação reenviado com sucesso!");
    } catch (error: any) {
      await sendError(bot, chatId, error.message);
      await start(bot, chatId, userId);
    }
  }
}
