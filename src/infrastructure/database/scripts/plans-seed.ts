import "../../../config/env";
import { pool } from "../client";
import { logger } from "../../../shared/logger";
import { seedPlans } from "../seeds/plans.seed";

/**
 * `npm run plans:seed` — garante o catálogo de planos padrão.
 *
 * Independe do modo demonstração de propósito: é catálogo permanente do produto, necessário em
 * qualquer instalação. Idempotente (upsert), então rodar de novo num sistema já configurado só
 * reconverge os planos padrão para o estado versionado, sem tocar em planos criados pelo painel.
 */
seedPlans()
  .then(async (count) => {
    logger.info({ count }, "Catálogo de planos padrão semeado");
    await pool.end();
    process.exit(0);
  })
  .catch(async (err) => {
    logger.error({ err }, "Falha ao semear o catálogo de planos");
    await pool.end();
    process.exit(1);
  });
