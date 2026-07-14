import { ExternalServiceError } from "../../../shared/errors";

/** Traduz uma falha de envio SMTP (nodemailer) em `ExternalServiceError`, sem vazar credenciais na mensagem. */
export function toSmtpError(error: unknown): ExternalServiceError {
  const message = (error as Error)?.message ?? "erro desconhecido";
  return new ExternalServiceError(`Falha ao enviar e-mail via SMTP: ${message}`);
}
