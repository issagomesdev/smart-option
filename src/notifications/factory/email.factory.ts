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
 * `APP_DEMO=true` não troca o provedor: **embrulha** o real num `DemoEmailProvider`, que descarta
 * apenas o que é endereçado aos usuários fictícios do seeder e entrega o resto normalmente. Antes
 * a demonstração suprimia todo e-mail, e isso travava o cadastro pelo bot — o login exige e-mail
 * validado, e o link nunca chegava. A composição mantém a garantia que importa (nada sai para
 * endereço inventado) sem quebrar o fluxo de quem está experimentando de verdade.
 */
export function getEmailProvider(): EmailProvider {
  if (!provider) {
    const real = env.EMAIL_TYPE === "smtp" ? new SmtpProvider() : new ResendProvider();
    provider = isDemo ? new DemoEmailProvider(real) : real;
  }
  return provider;
}
