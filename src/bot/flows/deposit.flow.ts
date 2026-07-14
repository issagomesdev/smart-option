import TelegramBot from "node-telegram-bot-api";
import { sessionService, BotSession } from "../session.service";
import { backToFinancialMenuKeyboard, inlineKeyboard } from "../keyboards";
import { generatePaymentLink } from "../payment-link";

const VALUE_REGEX = /^\d+(,\d{1,2})?$/;

function formatBRL(value: number): string {
  return (Math.floor(value * 100) / 100).toString().replace(".", ",");
}

export async function start(bot: TelegramBot, chatId: number, userId: number): Promise<void> {
  await sessionService.enterFlow(userId, "deposit", "value", {});
  await bot.sendMessage(chatId, "Digite corretamente a quantia que deseja depositar, utilize somente numeros e para separar os centavos use virgula:", {
    reply_markup: backToFinancialMenuKeyboard(),
  });
}

export async function handleMessage(bot: TelegramBot, msg: TelegramBot.Message, session: BotSession): Promise<void> {
  const chatId = msg.chat.id;
  const userId = msg.from!.id;
  const text = msg.text ?? "";

  if (session.step !== "value") return;

  if (!VALUE_REGEX.test(text)) {
    await bot.sendMessage(chatId, "Valor incorreto! digite novamente a quantia que deseja depositar, utilize somente numeros e para separar os centavos use virgula:");
    return;
  }

  const value = parseFloat(text.replace(",", "."));
  await bot.sendMessage(chatId, `o valor a ser depositado é R$ ${formatBRL(value)}`);
  await bot.sendMessage(
    chatId,
    "Confirma?",
    inlineKeyboard([
      { text: "✅ SIM", callback_data: `choice=yes&for=confirm-deposit-value&value=${text}` },
      { text: "❌ NÃO", callback_data: `choice=no&for=confirm-deposit-value&value=${text}` },
    ]),
  );
  await sessionService.setStep(userId, "confirm");
}

export async function handleCallback(bot: TelegramBot, query: TelegramBot.CallbackQuery): Promise<void> {
  const chatId = query.message!.chat.id;
  const userId = query.from.id;
  const params = new URLSearchParams(query.data ?? "");

  if (params.get("for") !== "confirm-deposit-value") return;

  if (params.get("choice") === "yes") {
    const value = parseFloat((params.get("value") ?? "0").replace(",", "."));
    await sessionService.clear(userId);
    await generatePaymentLink(bot, chatId, userId, value);
  } else {
    await bot.sendMessage(chatId, "Para completar seu depósito, digite novamente a quantia que desejada, utilize somente numeros e para separar os centavos use virgula:");
    await sessionService.setStep(userId, "value");
  }
}
