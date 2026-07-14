import { renderInfoEmail } from "./layout";

export interface WithdrawalApprovedTemplateData {
  amount: string;
}

export function withdrawalApprovedTemplate(data: WithdrawalApprovedTemplateData): { subject: string; html: string } {
  return {
    subject: "Saque aprovado",
    html: renderInfoEmail({
      title: "Saque aprovado",
      message: `Seu saque no valor de ${data.amount} foi aprovado e está a caminho da sua conta.`,
    }),
  };
}
