import "../../../config/env";
import { pool } from "../client";
import { redis } from "../../cache/redis";
import { logger } from "../../../shared/logger";
import { runDemoReset } from "../seeds/demo-reset.logic";

/**
 * `npm run demo:reset` — restaura o ambiente de demonstração ao estado inicial.
 *
 * Equivalente ao `php artisan demo:reset` do pedido original (este backend é Node/Express/Drizzle,
 * não Laravel — não há Artisan). A trava vive em `runDemoReset`, não aqui: qualquer caminho de
 * chamada (CLI ou agendador) esbarra nela.
 */
runDemoReset()
  .then(async (summary) => {
    logger.info(summary, "demo:reset finalizado");
    await redis.quit().catch(() => undefined);
    await pool.end();
    process.exit(0);
  })
  .catch(async (err) => {
    // Erro esperado e desejável quando APP_DEMO=false — a mensagem já explica o motivo da recusa.
    logger.error({ err: err instanceof Error ? err.message : err }, "demo:reset não foi executado");
    await redis.quit().catch(() => undefined);
    await pool.end();
    process.exit(1);
  });
