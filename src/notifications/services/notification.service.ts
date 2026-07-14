import { env } from "../../config/env";
import { logger } from "../../shared/logger";
import { getEmailProvider } from "../factory/email.factory";
import { EmailMessage, EmailProvider } from "../interfaces/email.provider";
import {
  emailVerificationTemplate,
  EmailVerificationTemplateData,
  registrationConfirmationTemplate,
  RegistrationConfirmationTemplateData,
  passwordResetTemplate,
  PasswordResetTemplateData,
  passwordChangedTemplate,
  PasswordChangedTemplateData,
  depositConfirmedTemplate,
  DepositConfirmedTemplateData,
  withdrawalRequestedTemplate,
  WithdrawalRequestedTemplateData,
  withdrawalApprovedTemplate,
  WithdrawalApprovedTemplateData,
  planPurchaseTemplate,
  PlanPurchaseTemplateData,
  planRenewalTemplate,
  PlanRenewalTemplateData,
  supportTemplate,
  SupportTemplateData,
} from "../templates";

/**
 * Fachada única do módulo de notificações. Nenhum outro lugar da aplicação
 * deve chamar `getEmailProvider()`/um provider concreto diretamente — tudo
 * passa por aqui.
 */
export class NotificationService {
  constructor(private readonly provider: EmailProvider = getEmailProvider()) {}

  private async sendEmail(message: EmailMessage): Promise<void> {
    const startedAt = Date.now();
    try {
      const result = await this.provider.send(message);
      logger.info(
        { to: message.to, provider: result.provider, durationMs: Date.now() - startedAt },
        "E-mail enviado com sucesso",
      );
    } catch (error) {
      logger.error(
        { to: message.to, provider: env.EMAIL_TYPE, durationMs: Date.now() - startedAt, err: error },
        "Falha ao enviar e-mail",
      );
      throw error;
    }
  }

  async sendEmailVerification(input: { to: string } & EmailVerificationTemplateData): Promise<void> {
    const { subject, html } = emailVerificationTemplate(input);
    await this.sendEmail({ to: input.to, subject, html });
  }

  async sendRegistrationConfirmation(input: { to: string } & RegistrationConfirmationTemplateData): Promise<void> {
    const { subject, html } = registrationConfirmationTemplate(input);
    await this.sendEmail({ to: input.to, subject, html });
  }

  async sendPasswordReset(input: { to: string } & PasswordResetTemplateData): Promise<void> {
    const { subject, html } = passwordResetTemplate(input);
    await this.sendEmail({ to: input.to, subject, html });
  }

  async sendPasswordChanged(input: { to: string } & PasswordChangedTemplateData): Promise<void> {
    const { subject, html } = passwordChangedTemplate(input);
    await this.sendEmail({ to: input.to, subject, html });
  }

  async sendDepositConfirmed(input: { to: string } & DepositConfirmedTemplateData): Promise<void> {
    const { subject, html } = depositConfirmedTemplate(input);
    await this.sendEmail({ to: input.to, subject, html });
  }

  async sendWithdrawalRequested(input: { to: string } & WithdrawalRequestedTemplateData): Promise<void> {
    const { subject, html } = withdrawalRequestedTemplate(input);
    await this.sendEmail({ to: input.to, subject, html });
  }

  async sendWithdrawalApproved(input: { to: string } & WithdrawalApprovedTemplateData): Promise<void> {
    const { subject, html } = withdrawalApprovedTemplate(input);
    await this.sendEmail({ to: input.to, subject, html });
  }

  async sendPlanPurchase(input: { to: string } & PlanPurchaseTemplateData): Promise<void> {
    const { subject, html } = planPurchaseTemplate(input);
    await this.sendEmail({ to: input.to, subject, html });
  }

  async sendPlanRenewal(input: { to: string } & PlanRenewalTemplateData): Promise<void> {
    const { subject, html } = planRenewalTemplate(input);
    await this.sendEmail({ to: input.to, subject, html });
  }

  async sendSupport(input: { to: string } & SupportTemplateData): Promise<void> {
    const { subject, html } = supportTemplate(input);
    await this.sendEmail({ to: input.to, subject, html });
  }
}

export const notificationService = new NotificationService();
