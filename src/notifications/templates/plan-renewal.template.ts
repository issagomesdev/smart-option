import { renderInfoEmail } from "./layout";

export interface PlanRenewalTemplateData {
  planName: string;
}

export function planRenewalTemplate(data: PlanRenewalTemplateData): { subject: string; html: string } {
  return {
    subject: "Renovação de plano confirmada",
    html: renderInfoEmail({
      title: "Plano renovado com sucesso",
      message: `A renovação do plano ${data.planName} foi confirmada.`,
    }),
  };
}
