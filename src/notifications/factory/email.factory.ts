import { env } from "../../config/env";
import { EmailProvider } from "../interfaces/email.provider";
import { ResendProvider } from "../providers/resend/resend.provider";
import { SmtpProvider } from "../providers/smtp/smtp.provider";

let provider: EmailProvider | null = null;

/**
 * Único ponto de obtenção de um `EmailProvider`. O resto da aplicação depende
 * da interface, não da implementação — trocar (ou adicionar) provedor de
 * e-mail não deveria exigir tocar em nenhum consumidor além desta função.
 * Seleção exclusiva por `EMAIL_TYPE`, nunca por condicional espalhada.
 */
export function getEmailProvider(): EmailProvider {
  if (!provider) {
    provider = env.EMAIL_TYPE === "smtp" ? new SmtpProvider() : new ResendProvider();
  }
  return provider;
}
