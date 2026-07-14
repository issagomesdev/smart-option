import { env } from "../../../config/env";
import { EmailMessage, EmailProvider, EmailSendResult } from "../../interfaces/email.provider";
import { withRetry } from "../shared/retry";
import { smtpTransport } from "./smtp-transport";
import { toSmtpError } from "./errors";

export class SmtpProvider implements EmailProvider {
  async send(message: EmailMessage): Promise<EmailSendResult> {
    try {
      return await withRetry(async () => {
        const from = env.MAIL_FROM_NAME ? `${env.MAIL_FROM_NAME} <${env.SMTP_USER}>` : env.SMTP_USER;

        const info = await smtpTransport.sendMail({
          from,
          to: message.to,
          subject: message.subject,
          html: message.html,
        });

        return { provider: "smtp" as const, messageId: info.messageId as string };
      });
    } catch (error) {
      throw toSmtpError(error);
    }
  }
}
