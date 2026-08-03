import { env } from "./env";
import { ForbiddenError } from "../shared/errors";

/**
 * Ponto único de verdade do modo demonstração. Nenhum outro módulo lê `env.APP_DEMO` direto — assim
 * existe um lugar só para auditar (e testar) o que separa a demonstração da produção.
 */
export const isDemo = env.APP_DEMO;

/** Mensagem exibida ao usuário sempre que uma ação é recusada por estar no modo demonstração. */
export const DEMO_BLOCKED_MESSAGE = "Esta ação está desabilitada na demonstração.";

/**
 * Domínio dos endereços gerados pelo seeder da demonstração (`demo.seed.ts`).
 *
 * Vive aqui, e não no seeder, porque tem dois consumidores em camadas diferentes: quem *gera* os
 * endereços e quem precisa *reconhecê-los* para não tentar entregar e-mail a eles
 * (`DemoEmailProvider`). Importar o seeder de dentro de `notifications/` inverteria a dependência.
 */
export const DEMO_SEED_EMAIL_DOMAIN = "exemplo.com.br";

/**
 * Um endereço é fictício quando pertence ao domínio do seeder — nunca existiu, nunca vai receber
 * nada. Tudo o mais foi digitado por uma pessoa de verdade no fluxo de cadastro.
 */
export function isSeededEmailAddress(email: string): boolean {
  return email.trim().toLowerCase().endsWith(`@${DEMO_SEED_EMAIL_DOMAIN}`);
}

/**
 * Trava das rotinas destrutivas (reset do ambiente). Chamada no início de todo caminho de reset —
 * CLI e agendador. Com `APP_DEMO=false` o reset é impossível, que é a garantia de que uma instalação
 * de produção nunca perde dado por causa deste módulo.
 */
export function assertDemoEnabled(operation: string): void {
  if (!isDemo) {
    throw new Error(
      `"${operation}" só pode rodar com APP_DEMO=true. Esta operação apaga dados e foi recusada para proteger o ambiente atual.`,
    );
  }
}

/**
 * Trava das operações irreversíveis ou com efeito fora do ambiente (PIX real na Asaas, e-mail real,
 * credenciais administrativas). Diferente de `assertDemoEnabled`, esta recusa quando o modo demo
 * ESTÁ ligado — é o guard de "quase tudo funciona, menos o que não dá pra desfazer".
 */
export function assertNotDemo(): void {
  if (isDemo) throw new ForbiddenError(DEMO_BLOCKED_MESSAGE);
}

/** Intervalo do reset automático em milissegundos, ou `null` quando o reset automático está desligado. */
export function resolveAutoResetIntervalMs(): number | null {
  if (!isDemo || !env.AUTO_RESET || !env.AUTO_RESET_INTERVAL) return null;
  return env.AUTO_RESET_INTERVAL * 60 * 1000;
}
