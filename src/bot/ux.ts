import TelegramBot from "node-telegram-bot-api";

/**
 * Convenções únicas de mensagem do bot — antes cada seção formatava erro e
 * sucesso de um jeito ligeiramente diferente (`⚠ *msg*` na maioria dos
 * lugares, mas `Erro: *msg*` em `components/index.ts`; sucesso em itálico na
 * maioria, texto plano no cadastro). Centralizado aqui para não divergir de
 * novo conforme os fluxos forem sendo tocados.
 */
export async function sendError(bot: TelegramBot, chatId: number, message: string): Promise<void> {
  await bot.sendMessage(chatId, `⚠ *${message}*`, { parse_mode: "Markdown" });
}

export async function sendSuccess(bot: TelegramBot, chatId: number, message: string): Promise<void> {
  await bot.sendMessage(chatId, `_${message}_`, { parse_mode: "Markdown" });
}

/** Indicador de "digitando..." do Telegram — usar antes de qualquer operação assíncrona (chamada externa, consulta pesada). */
export async function sendTyping(bot: TelegramBot, chatId: number): Promise<void> {
  try {
    await bot.sendChatAction(chatId, "typing");
  } catch {
    // Indicador é cosmético — nunca deve derrubar o fluxo se falhar.
  }
}
