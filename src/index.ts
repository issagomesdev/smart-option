import { env } from "./config/env";
import Server from "./server/index";
import routes from "./server/routes";
import { bot, start } from "./bot";
import { startAsaasWebhookWorker, stopAsaasWebhookWorker } from "./infrastructure/queue/workers/asaas-webhook.worker";
import { pool as drizzlePool } from "./infrastructure/database/client";
import legacyPool from "./db";
import { redis } from "./infrastructure/cache/redis";
import { logger } from "./shared/logger";

const server = new Server().router(routes).listen(env.APP_PORT);
start();
startAsaasWebhookWorker();

let shuttingDown = false;

async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;

  logger.info({ signal }, "Encerrando aplicação");

  await server.close().catch((err) => logger.error({ err }, "Erro ao fechar o servidor HTTP"));
  await bot.stopPolling().catch((err) => logger.error({ err }, "Erro ao parar o polling do bot"));
  await stopAsaasWebhookWorker().catch((err) => logger.error({ err }, "Erro ao encerrar o worker de webhooks"));
  await drizzlePool.end().catch((err) => logger.error({ err }, "Erro ao fechar o pool de conexões Drizzle"));
  await legacyPool.end().catch((err) => logger.error({ err }, "Erro ao fechar o pool de conexões legado"));
  redis.disconnect();

  logger.info("Aplicação encerrada com sucesso");
  process.exit(0);
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
