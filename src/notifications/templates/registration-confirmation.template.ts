import { renderInfoEmail } from "./layout";

export interface RegistrationConfirmationTemplateData {
  name: string;
}

export function registrationConfirmationTemplate(
  data: RegistrationConfirmationTemplateData,
): { subject: string; html: string } {
  return {
    subject: "Cadastro confirmado — bem-vindo(a) à Smart Option",
    html: renderInfoEmail({
      title: `Olá, ${data.name}!`,
      message: "Seu cadastro na Smart Option foi concluído com sucesso. Agora você já pode fazer login e começar a investir.",
    }),
  };
}
