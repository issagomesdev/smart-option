import { isAxiosError } from "axios";
import { ExternalServiceError } from "../../../shared/errors";

/** Traduz uma falha HTTP contra o Resend em `ExternalServiceError`, sem vazar detalhes internos do axios. */
export function toResendError(error: unknown): ExternalServiceError {
  if (isAxiosError(error)) {
    const description = error.response?.data?.message ?? error.message;
    return new ExternalServiceError(`Falha ao enviar e-mail via Resend: ${description}`, {
      status: error.response?.status,
      data: error.response?.data,
    });
  }
  return new ExternalServiceError(`Falha ao enviar e-mail via Resend: ${(error as Error)?.message ?? "erro desconhecido"}`);
}
