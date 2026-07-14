import { renderCtaEmail } from "./layout";

export interface EmailVerificationTemplateData {
  verificationUrl: string;
}

export function emailVerificationTemplate(data: EmailVerificationTemplateData): { subject: string; html: string } {
  return {
    subject: "Confirmação de e-mail",
    html: renderCtaEmail({
      message: "Para seguir, basta confirmar seu endereço de e-mail clicando no botão abaixo:",
      ctaLabel: "Confirmar meu e-mail",
      ctaUrl: data.verificationUrl,
      footer: "Caso não tenha sido você que tentou criar esta conta, desconsidere este e-mail.",
    }),
  };
}
