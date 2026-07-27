import { env } from "../../config/env";
import { isDemo } from "../../config/demo";
import { EmailProvider } from "../interfaces/email.provider";
import { DemoEmailProvider } from "../providers/demo/demo.provider";
import { ResendProvider } from "../providers/resend/resend.provider";
import { SmtpProvider } from "../providers/smtp/smtp.provider";

let provider: EmailProvider | null = null;

/**
 * Único ponto de obtenção de um `EmailProvider`. O resto da aplicação depende
 * da interface, não da implementação — trocar (ou adicionar) provedor de
 * e-mail não deveria exigir tocar em nenhum consumidor além desta função.
 * Seleção exclusiva por `EMAIL_TYPE`, nunca por condicional espalhada.
 *
 * `APP_DEMO=true` tem precedência sobre `EMAIL_TYPE`: no ambiente de demonstração nada é enviado
 * de verdade (ver `DemoEmailProvider`). É a mesma filosofia dos guards de rota — a demonstração
 * não pode produzir efeito fora do próprio ambiente.
 */
export function getEmailProvider(): EmailProvider {
  if (!provider) {
    if (isDemo) provider = new DemoEmailProvider();
    else provider = env.EMAIL_TYPE === "smtp" ? new SmtpProvider() : new ResendProvider();
  }
  return provider;
}
