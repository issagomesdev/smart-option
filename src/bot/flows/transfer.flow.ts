import TelegramBot from "node-telegram-bot-api";
import { AuthenticationService } from "../../services/bot/auth.service";
import { TransactionsService } from "../../services/bot/transactions.service";
import { sessionService, BotSession } from "../session.service";
import { backToFinancialMenuKeyboard, inlineKeyboard } from "../keyboards";
import { sendError, sendTyping } from "../ux";

const VALUE_REGEX = /^\d+(,\d{1,2})?$/;

function formatBRL(value: number): string {
  return (Math.floor(value * 100) / 100).toString().replace(".", ",");
}

interface TransferData {
  value?: string;
  email?: string;
}

export async function start(bot: TelegramBot, chatId: number, userId: number): Promise<void> {
  await sessionService.enterFlow(userId, "transfer", "value", {});
  await bot.sendMessage(chatId, "Digite corretamente a quantia que deseja transferir, utilize somente numeros e para separar os centavos use virgula:", {
    reply_markup: backToFinancialMenuKeyboard(),
  });
}

export async function handleMessage(bot: TelegramBot, msg: TelegramBot.Message, session: BotSession): Promise<void> {
  const chatId = msg.chat.id;
  const userId = msg.from!.id;
  const text = msg.text ?? "";
  const data = session.data as TransferData;

  if (session.step === "value") {
    if (!VALUE_REGEX.test(text)) {
      await bot.sendMessage(chatId, "Valor incorreto! digite novamente a quantia que deseja transferir, utilize somente numeros e para separar os centavos use virgula:");
      return;
    }

    const value = parseFloat(text.replace(",", "."));
    const balance = await TransactionsService.balance(userId);

    if (value > balance) {
      await bot.sendMessage(chatId, `O valor digitado é superior ao saldo em conta (R$ ${formatBRL(balance)}). Para completar sua transferência, digite novamente a quantia que desejada, utilize somente numeros e para separar os centavos use virgula:`);
      return;
    }

    await sessionService.set(userId, { flow: "transfer", step: "email", data: { ...data, value: text } });
    await bot.sendMessage(chatId, "Agora informe o e-mail do destinatário para o qual deseja realizar a transferência");
    return;
  }

  if (session.step === "email") {
    try {
      await AuthenticationService.existingUser(text, String(userId));
      await sessionService.set(userId, { flow: "transfer", step: "confirm", data: { ...data, email: text } });
      await bot.sendMessage(chatId, "Você está a um passo de realizar a transferência!");
      await bot.sendMessage(
        chatId,
        `Valor: R$ ${data.value}\nEmail: ${text}`,
        inlineKeyboard([
          { text: "Confirmar", callback_data: "choice=confirm&for=confirm-transfer-infos" },
          { text: "Cancelar", callback_data: "choice=cancel&for=confirm-transfer-infos" },
        ]),
      );
    } catch (error: any) {
      await bot.sendMessage(chatId, `⚠ ${error.message}, insira novamente o e-mail do destinatário para o qual deseja realizar a transferência`);
    }
  }
}

export async function handleCallback(bot: TelegramBot, query: TelegramBot.CallbackQuery, session: BotSession): Promise<void> {
  const chatId = query.message!.chat.id;
  const userId = query.from.id;
  const params = new URLSearchParams(query.data ?? "");
  const data = session.data as TransferData;

  if (params.get("for") !== "confirm-transfer-infos") return;

  if (params.get("choice") === "confirm") {
    await sendTyping(bot, chatId);
    try {
      const value = parseFloat((data.value ?? "0").replace(",", "."));
      const message = await TransactionsService.transfersBetweenUsers(value, userId, data.email!);
      await sessionService.clear(userId);
      await bot.sendMessage(chatId, message, { parse_mode: "Markdown" });
    } catch (error: any) {
      await sendError(bot, chatId, error.message);
    }
  } else {
    await bot.sendMessage(chatId, "Para completar seu depósito, digite novamente a quantia que desejada, utilize somente numeros e para separar os centavos use virgula:");
    await sessionService.set(userId, { flow: "transfer", step: "value", data: {} });
  }
}
