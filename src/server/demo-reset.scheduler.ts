import { resolveAutoResetIntervalMs } from "../config/demo";
import { runDemoReset } from "../infrastructure/database/seeds/demo-reset.logic";
import { logger } from "../shared/logger";

/**
 * Reset periódico do ambiente de demonstração (`AUTO_RESET` + `AUTO_RESET_INTERVAL`).
 *
 * Usa `setInterval` em vez de `node-cron` (o padrão do resto do projeto, em `server/cron.ts`) porque
 * o intervalo aqui é livre em minutos — 90, 45, 20 minutos não têm expressão cron equivalente, e
 * arredondar silenciosamente para a hora cheia entregaria uma cadência diferente da configurada.
 *
 * Roda no mesmo processo do servidor HTTP, como os crons existentes. Isso é seguro porque a
 * aplicação é um processo único (API + bot + worker em `src/index.ts`, sem réplicas em nenhum dos
 * compose) — não há corrida entre instâncias disputando o reset.
 */
let timer: NodeJS.Timeout | null = null;
let running = false;

async function tick(): Promise<void> {
  // Um reset com muitos dados pode passar do intervalo configurado; sem esta trava, dois resets
  // simultâneos truncariam tabelas enquanto o outro insere.
  if (running) {
    logger.warn("Reset automático ainda em execução — ciclo ignorado");
    return;
  }

  running = true;
  try {
    await runDemoReset();
  } catch (error) {
    // Nunca derruba o servidor: uma demonstração no ar com dados velhos é melhor que fora do ar.
    logger.error({ err: error }, "Falha no reset automático do ambiente de demonstração");
  } finally {
    running = false;
  }
}

export function startDemoResetScheduler(): void {
  const intervalMs = resolveAutoResetIntervalMs();
  // `null` quando APP_DEMO ou AUTO_RESET estão desligados — o agendador simplesmente não existe
  // fora do modo demonstração, em vez de existir e não fazer nada.
  if (intervalMs === null) return;

  timer = setInterval(() => void tick(), intervalMs);
  // Não segura o event loop aberto no shutdown.
  timer.unref();

  logger.warn(
    { intervalMinutes: intervalMs / 60_000 },
    "Reset automático do ambiente de demonstração agendado",
  );
}

export function stopDemoResetScheduler(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}
