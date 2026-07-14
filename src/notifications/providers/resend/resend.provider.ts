import { env } from "../../../config/env";
import { EmailMessage, EmailProvider, EmailSendResult } from "../../interfaces/email.provider";
import { withRetry } from "../shared/retry";
import { resendHttpClient } from "./resend-http-client";
import { toResendError } from "./errors";

export class ResendProvider implements EmailProvider {
  async send(message: EmailMessage): Promise<EmailSendResult> {
    try {
      return await withRetry(async () => {
        const { data } = await resendHttpClient.post<{ id: string }>("/emails", {
          from: `${env.MAIL_FROM_NAME} <${env.MAIL_FROM_ADDRESS}>`,
          to: message.to,
          subject: message.subject,
          html: message.html,
        });

        return { provider: "resend" as const, messageId: data.id };
      });
    } catch (error) {
      throw toResendError(error);
    }
  }
}
