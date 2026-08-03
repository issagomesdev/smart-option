import { randomUUID } from "node:crypto";
import { env } from "../../../config/env";
import { isSeededEmailAddress } from "../../../config/demo";
import { logger } from "../../../shared/logger";
import type { EmailMessage, EmailProvider, EmailSendResult } from "../../interfaces/email.provider";

/**
 * Filtro de e-mail do modo demonstração: entrega de verdade o que foi endereçado a uma pessoa e
 * descarta o que foi endereçado aos usuários fictícios do seeder.
 *
 * A demonstração é povoada por centenas de contas com endereços `@exemplo.com.br` que nunca
 * existiram. Sem este filtro, todo fluxo que dispara e-mail tentaria entregá-los pela Resend/SMTP,
 * queimando cota e derrubando a reputação do domínio com bounces em massa.
 *
 * Suprimir *tudo*, porém, quebrava o produto logo na primeira tela: o cadastro pelo bot exige
 * validar o e-mail antes de liberar o login (`AuthenticationService` recusa com "Email não
 * validado"), então um visitante que se cadastrasse nunca recebia o link e ficava travado.
 * Filtrar por destinatário resolve os dois lados — o fluxo funciona de ponta a ponta para quem
 * está experimentando, e nada sai para endereço inventado.
 *
 * Decorator, não substituto: recebe o provedor real e delega. A escolha entre Resend e SMTP
 * continua sendo só do `EMAIL_TYPE`, e este arquivo não precisa saber qual dos dois está ativo.
 */
export class DemoEmailProvider implements EmailProvider {
  constructor(private readonly delegate: EmailProvider) {}

  async send(message: EmailMessage): Promise<EmailSendResult> {
    if (!isSeededEmailAddress(message.to)) {
      return this.delegate.send(message);
    }

    logger.info(
      { to: message.to, subject: message.subject, provider: "demo" },
      "E-mail suprimido: destinatário fictício do seeder da demonstração",
    );

    // Mantém o contrato de `EmailSendResult`, cujo `provider` é o enum dos provedores reais — o
    // chamador não precisa saber que está em demonstração para continuar funcionando.
    return { provider: env.EMAIL_TYPE, messageId: `demo-${randomUUID()}` };
  }
}
