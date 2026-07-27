import { sql } from "drizzle-orm";
import { db } from "../client";
import { redis } from "../../cache/redis";
import { logger } from "../../../shared/logger";
import { assertDemoEnabled } from "../../../config/demo";
import { seedPlans } from "./plans.seed";
import { seedDemoData, type DemoSeedSummary } from "./demo.seed";

/**
 * Tabelas transacionais/de negócio limpas a cada reset, em ordem FK-segura (filhas antes das pais).
 *
 * `staff_users` e `roles` NÃO estão na lista, de propósito: um reset não pode tirar o acesso de
 * quem administra o ambiente nem apagar staff criado durante a demonstração. `products` também não
 * é truncada — é catálogo, reconvergido logo depois por `seedPlans()` (upsert), o que preserva os
 * IDs fixos que `src/server/cron.ts` referencia.
 */
const TABLES_TO_CLEAR = [
  "audit_logs",
  "webhook_logs",
  "payment_events",
  "payment_transactions",
  "wallet_transactions",
  "wallet",
  "balance",
  "withdrawals",
  "checkouts",
  "users_plans",
  "network",
  "requests",
  "verification_email",
  "staff_refresh_tokens",
  "bot_users",
] as const;

/** Além do qual desistimos de limpar o cache — o TTL de 45s do dashboard resolve sozinho. */
const CACHE_CLEAR_TIMEOUT_MS = 5_000;

/**
 * Invalida o cache do dashboard (`DashboardService.getSummary`, prefixo `dashboard:summary:`);
 * sem isso o painel continuaria mostrando os números de antes do reset até o TTL expirar,
 * parecendo que o reset não funcionou.
 *
 * Best-effort, com timeout, e deliberadamente **nunca** propaga erro: o cliente Redis do projeto usa
 * `maxRetriesPerRequest: null` (`infrastructure/cache/redis.ts`), o que faz o ioredis tentar
 * indefinidamente quando o servidor está inacessível — sem este timeout o reset TRAVA para sempre
 * com o banco já truncado. No agendador o estrago é pior: `running` nunca voltaria a `false` e o
 * reset automático morreria em silêncio. Falhar aqui é inofensivo perto disso: o cache expira em 45s.
 */
async function clearDashboardCache(): Promise<void> {
  const timeout = new Promise<never>((_resolve, reject) =>
    setTimeout(() => reject(new Error("timeout ao limpar o cache")), CACHE_CLEAR_TIMEOUT_MS).unref(),
  );

  try {
    await Promise.race([
      (async () => {
        const cachedKeys = await redis.keys("dashboard:*");
        if (cachedKeys.length > 0) await redis.del(...cachedKeys);
      })(),
      timeout,
    ]);
  } catch (error) {
    logger.warn(
      { err: error instanceof Error ? error.message : error },
      "Cache do dashboard não foi limpo — os números antigos podem aparecer por até 45s (TTL)",
    );
  }
}

export interface DemoResetSummary extends DemoSeedSummary {
  clearedTables: number;
  plans: number;
  durationMs: number;
}

/**
 * Restaura o ambiente de demonstração ao estado inicial: limpa as movimentações, reconverge o
 * catálogo de planos e regenera os dados de demonstração.
 *
 * **Destrutivo por natureza.** A primeira linha é a trava: sem `APP_DEMO=true` a função recusa
 * antes de tocar em qualquer tabela. É essa checagem que garante que uma instalação de produção
 * nunca perde dados por este caminho — ela existe de novo aqui, e não só em quem chama, porque
 * tanto o CLI quanto o agendador chamam esta função e nenhum dos dois pode ser o único guardião.
 */
export async function runDemoReset(): Promise<DemoResetSummary> {
  assertDemoEnabled("demo:reset");

  const startedAt = Date.now();
  logger.warn({ tables: TABLES_TO_CLEAR.length }, "Reset do ambiente de demonstração iniciado");

  // `TRUNCATE` é DDL no MySQL: causa commit implícito e não pode ser desfeito por ROLLBACK, então
  // envolver tudo numa transação daria uma falsa sensação de atomicidade. `DELETE` dentro de uma
  // transação seria atômico, mas não reinicia o AUTO_INCREMENT — e IDs sempre crescendo entre
  // resets tornariam o cenário não-reprodutível. Optamos por TRUNCATE + reseed idempotente: se algo
  // falhar no meio, rodar de novo converge para o mesmo estado final.
  await db.execute(sql`SET FOREIGN_KEY_CHECKS = 0`);
  try {
    for (const table of TABLES_TO_CLEAR) {
      await db.execute(sql.raw(`TRUNCATE TABLE \`${table}\``));
    }
  } finally {
    await db.execute(sql`SET FOREIGN_KEY_CHECKS = 1`);
  }

  const plans = await seedPlans();
  const seeded = await seedDemoData();

  await clearDashboardCache();

  const summary: DemoResetSummary = {
    ...seeded,
    clearedTables: TABLES_TO_CLEAR.length,
    plans,
    durationMs: Date.now() - startedAt,
  };

  logger.warn(summary, "Reset do ambiente de demonstração concluído");
  return summary;
}
