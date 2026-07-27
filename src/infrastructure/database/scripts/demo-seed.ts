import "../../../config/env";
import { pool } from "../client";
import { redis } from "../../cache/redis";
import { logger } from "../../../shared/logger";
import { runDemoReset } from "../seeds/demo-reset.logic";

/**
 * `npm run demo:seed` — restaura o ambiente e regenera os dados de demonstração.
 *
 * **Sempre limpa antes de semear.** Sem isso, execuções sucessivas acumulariam usuários fictícios
 * (cada rodada cria ~300 com carteiras e milhares de lançamentos), e o ambiente cresceria sem
 * limite a cada chamada em vez de convergir para um cenário conhecido.
 *
 * Como `runDemoReset` já termina semeando (trunca → catálogo de planos → dados de demonstração),
 * este comando é hoje **equivalente a `npm run demo:reset`** — a diferença é só o nome pelo qual se
 * chama a mesma operação. Ele delega em vez de duplicar a lógica, então não há como os dois
 * caminhos divergirem.
 *
 * A trava de `APP_DEMO` continua valendo: vive dentro de `runDemoReset`, no início, antes de
 * qualquer escrita.
 */
runDemoReset()
  .then(async (summary) => {
    logger.info(summary, "demo:seed finalizado");
    await redis.quit().catch(() => undefined);
    await pool.end();
    process.exit(0);
  })
  .catch(async (err) => {
    logger.error({ err: err instanceof Error ? err.message : err }, "demo:seed não foi executado");
    await redis.quit().catch(() => undefined);
    await pool.end();
    process.exit(1);
  });
