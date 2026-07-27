import { randomUUID } from "node:crypto";
import { env } from "../../../config/env";
import { logger } from "../../../shared/logger";
import type { EmailMessage, EmailProvider, EmailSendResult } from "../../interfaces/email.provider";

/**
 * Provedor de e-mail do modo demonstração: registra a mensagem no log e devolve sucesso, sem
 * enviar nada.
 *
 * Existe porque a demonstração é povoada por centenas de usuários fictícios com endereços
 * `@exemplo.com.br`, e todo fluxo que dispara e-mail (verificação de cadastro, avisos) tentaria
 * entregá-los de verdade pela Resend/SMTP — queimando cota, sujando a reputação do domínio e
 * potencialmente enviando mensagem para um endereço que exista de fato.
 *
 * A troca acontece na fábrica (`email.factory.ts`), não em condicional espalhada pelos
 * consumidores: quem envia e-mail continua dependendo só da interface `EmailProvider`.
 */
export class DemoEmailProvider implements EmailProvider {
  async send(message: EmailMessage): Promise<EmailSendResult> {
    logger.info(
      { to: message.to, subject: message.subject, provider: "demo" },
      "E-mail suprimido pelo modo demonstração (não enviado)",
    );

    // Mantém o contrato de `EmailSendResult`, cujo `provider` é o enum dos provedores reais — o
    // chamador não precisa saber que está em demonstração para continuar funcionando.
    return { provider: env.EMAIL_TYPE, messageId: `demo-${randomUUID()}` };
  }
}
