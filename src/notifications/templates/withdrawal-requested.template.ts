import { renderInfoEmail } from "./layout";

export interface WithdrawalRequestedTemplateData {
  amount: string;
}

export function withdrawalRequestedTemplate(
  data: WithdrawalRequestedTemplateData,
): { subject: string; html: string } {
  return {
    subject: "Saque solicitado",
    html: renderInfoEmail({
      title: "Saque solicitado",
      message: `Recebemos sua solicitação de saque no valor de ${data.amount}. Ela está em análise e você será notificado assim que for aprovada.`,
    }),
  };
}
