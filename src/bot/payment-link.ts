import TelegramBot from "node-telegram-bot-api";
import { TransactionsService } from "../services/bot/transactions.service";
import { sendError, sendTyping } from "./ux";

/** Gera uma cobrança PIX (depósito ou assinatura de plano) e envia QR Code + copia-e-cola ao usuário. */
export async function generatePaymentLink(bot: TelegramBot, chatId: number, userId: number, value: number, product: any = null): Promise<void> {
  await sendTyping(bot, chatId);
  try {
    const charge = await TransactionsService.checkout(userId, value, product);
    await bot.sendMessage(
      chatId,
      "Você deu um passo importante para aproveitar ao máximo nossos serviços incríveis! 🚀 Pague com PIX escaneando o QR Code ou usando o código Copia e Cola abaixo:",
    );
    await bot.sendPhoto(chatId, Buffer.from(charge.qrCodeImageBase64, "base64"));
    await bot.sendMessage(chatId, `\`${charge.qrCodePayload}\``, { parse_mode: "Markdown" });
    const expiresAt = charge.expiresAt.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
    await bot.sendMessage(
      chatId,
      `Este código expira em ${expiresAt}. Após efetuar o pagamento, aguarde a confirmação — pode levar alguns instantes. Assim que o pagamento for confirmado, seu saldo será atualizado automaticamente. Agradecemos por escolher nossos serviços! Se precisar de ajuda ou tiver alguma dúvida, estamos à disposição!`,
    );
  } catch (error: any) {
    await sendError(bot, chatId, error.message);
  }
}
