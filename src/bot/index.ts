import TelegramBot from "node-telegram-bot-api";
import { env } from "../config/env";
import { logger } from "../shared/logger";
import { handleCallback, handleMessage } from "./dispatcher";

export const bot = new TelegramBot(env.BOT_TOKEN, { polling: true });

/** `node-telegram-bot-api` embrulha o erro da API; o código vem no texto (`ETELEGRAM: 409 Conflict`). */
function isPollingConflict(error: unknown): boolean {
  const candidate = error as { code?: string | number; response?: { statusCode?: number }; message?: string } | undefined;
  return candidate?.response?.statusCode === 409 || /\b409\b|conflict/i.test(String(candidate?.message ?? ""));
}

/**
 * Dispatcher único, persistente durante toda a vida do processo. Substitui o
 * antigo padrão de `bot.on()`/`bot.removeListener()` registrado e removido
 * dinamicamente por seção — que fazia listeners de um usuário processarem
 * mensagens de todos os outros usuários simultâneos (estado global) e
 * empilhava listeners duplicados sempre que um menu era reaberto. Aqui o
 * roteamento é 100% determinado por `SessionService` (Redis, por usuário),
 * então múltiplas conversas concorrentes nunca se cruzam.
 *
 * O roteamento em si vive em `dispatcher.ts`: este módulo instancia o
 * `TelegramBot` com polling ligado no carregamento, o que o torna impossível
 * de importar em teste sem abrir conexão real com a API do Telegram.
 */
export async function start(): Promise<void> {
  bot.on("message", (msg) => handleMessage(bot, msg));
  bot.on("callback_query", (query) => handleCallback(bot, query));

  bot.on("polling_error", (error) => {
    // 409 do Telegram significa uma coisa só: outra instância está lendo updates com o MESMO
    // BOT_TOKEN. As duas recebem parte das mensagens, então cada toque é processado por um
    // processo diferente — o usuário vê frases repetidas e fluxos que "voltam sozinhos".
    // Aconteceu de verdade (um `npm run dev` esquecido junto do container): 385 destes em 30
    // minutos, todos registrados como um "Erro de polling" genérico que não ajudava ninguém.
    if (isPollingConflict(error)) {
      logger.error(
        "Conflito de polling (409): outra instância do bot está usando o mesmo BOT_TOKEN. " +
          "Enquanto isso durar, as mensagens são divididas entre os processos e as respostas saem duplicadas ou fora de ordem. " +
          "Encerre as instâncias extras (npm run dev / docker compose) e deixe apenas uma.",
      );
      return;
    }

    logger.error({ err: error }, "Erro de polling do bot");
  });

  logger.info("Bot Telegram iniciado");
}
