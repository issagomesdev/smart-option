import TelegramBot from "node-telegram-bot-api";
import { AppError } from "../shared/errors";
import { logger } from "../shared/logger";
import { sendError } from "./ux";

/**
 * Mensagem única para qualquer falha que não seja um erro de negócio previsto. O usuário do bot
 * nunca deve ver stack trace, SQL, nome de tabela nem mensagem em inglês — além de ser ruído
 * incompreensível, um erro cru do driver vaza a estrutura do banco e os parâmetros da consulta
 * (achado real: uma violação de chave única no cadastro devolveu ao usuário o INSERT inteiro,
 * com e-mail e hash da senha dentro).
 */
export const GENERIC_ERROR_MESSAGE =
  "Não foi possível concluir sua solicitação agora. Tente novamente em alguns instantes — se o problema continuar, entre em contato com o nosso suporte informando o que você estava fazendo.";

/**
 * Traduz qualquer erro para uma mensagem exibível ao usuário.
 *
 * `AppError` e suas subclasses (`ValidationError`, `ConflictError`, `NotFoundError`, …) carregam
 * mensagens escritas em português para o usuário final — é justamente esse o contrato da
 * hierarquia, e são as únicas repassadas literalmente. Todo o resto (erro do driver do banco,
 * timeout de rede, bug de programação) vira a mensagem genérica.
 */
export function toUserMessage(error: unknown): string {
  return error instanceof AppError ? error.message : GENERIC_ERROR_MESSAGE;
}

/**
 * Registra o erro real no log da aplicação e responde ao usuário em português.
 *
 * Nunca lança: é chamada de dentro de blocos `catch`, inclusive do catch de último recurso do
 * dispatcher. Se até o envio da mensagem de erro falhar (Telegram fora do ar, chat bloqueado),
 * a falha vai para o log e o processo segue — um erro ao reportar um erro não pode derrubar o bot.
 */
export async function replyWithError(
  bot: TelegramBot,
  chatId: number,
  error: unknown,
  context: Record<string, unknown> = {},
): Promise<void> {
  logger.error({ err: error, ...context }, "Erro ao processar interação do bot");

  const message = toUserMessage(error);

  try {
    await sendError(bot, chatId, message);
  } catch {
    // `sendError` formata em Markdown; um `_` ou `*` solto na mensagem faz a API do Telegram
    // recusar o envio inteiro. Repete sem formatação para que o usuário receba algo.
    try {
      await bot.sendMessage(chatId, `⚠ ${message}`);
    } catch (sendFailure) {
      logger.error({ err: sendFailure, ...context }, "Falha ao enviar a mensagem de erro ao usuário do bot");
    }
  }
}
