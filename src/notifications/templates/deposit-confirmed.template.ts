import { renderInfoEmail } from "./layout";

export interface DepositConfirmedTemplateData {
  amount: string;
}

export function depositConfirmedTemplate(data: DepositConfirmedTemplateData): { subject: string; html: string } {
  return {
    subject: "Depósito confirmado",
    html: renderInfoEmail({
      title: "Depósito confirmado",
      message: `Seu depósito de ${data.amount} foi confirmado e já está disponível no seu saldo.`,
    }),
  };
}
