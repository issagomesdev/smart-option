import { renderInfoEmail } from "./layout";

export interface PasswordChangedTemplateData {
  name: string;
}

export function passwordChangedTemplate(data: PasswordChangedTemplateData): { subject: string; html: string } {
  return {
    subject: "Sua senha foi alterada",
    html: renderInfoEmail({
      title: "Senha alterada com sucesso",
      message: `Olá, ${data.name}. Confirmamos que a senha da sua conta foi alterada. Caso não tenha sido você, entre em contato com o suporte imediatamente.`,
    }),
  };
}
