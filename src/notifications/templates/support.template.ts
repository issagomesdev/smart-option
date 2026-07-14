import { renderInfoEmail } from "./layout";

export interface SupportTemplateData {
  subject: string;
  message: string;
}

export function supportTemplate(data: SupportTemplateData): { subject: string; html: string } {
  return {
    subject: data.subject,
    html: renderInfoEmail({
      title: data.subject,
      message: data.message,
    }),
  };
}
