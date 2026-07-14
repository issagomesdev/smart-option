import { renderInfoEmail } from "./layout";

export interface PlanPurchaseTemplateData {
  planName: string;
}

export function planPurchaseTemplate(data: PlanPurchaseTemplateData): { subject: string; html: string } {
  return {
    subject: "Compra de plano confirmada",
    html: renderInfoEmail({
      title: "Plano contratado com sucesso",
      message: `A contratação do plano ${data.planName} foi confirmada. Bons investimentos!`,
    }),
  };
}
