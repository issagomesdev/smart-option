export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
}

export interface EmailSendResult {
  provider: "resend" | "smtp";
  messageId: string;
}

/**
 * Porta de saída do módulo de notificações. Nenhuma outra parte da aplicação
 * deve importar um provider concreto (ex.: Resend, SMTP) diretamente — sempre
 * através desta interface, obtida via `email.factory.ts`.
 */
export interface EmailProvider {
  send(message: EmailMessage): Promise<EmailSendResult>;
}
