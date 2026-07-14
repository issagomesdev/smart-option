import { renderCtaEmail } from "./layout";

export interface PasswordResetTemplateData {
  resetUrl: string;
}

export function passwordResetTemplate(data: PasswordResetTemplateData): { subject: string; html: string } {
  return {
    subject: "Recuperação de senha",
    html: renderCtaEmail({
      message: "Recebemos uma solicitação para redefinir sua senha. Clique no botão abaixo para escolher uma nova senha:",
      ctaLabel: "Redefinir minha senha",
      ctaUrl: data.resetUrl,
      footer: "Caso não tenha sido você que solicitou, desconsidere este e-mail — sua senha atual continua válida.",
    }),
  };
}
