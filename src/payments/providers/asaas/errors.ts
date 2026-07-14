import { isAxiosError } from "axios";
import { ExternalServiceError } from "../../../shared/errors";

/** Traduz uma falha HTTP contra a Asaas em `ExternalServiceError`, sem vazar detalhes internos do axios. */
export function toAsaasError(error: unknown, action: string): ExternalServiceError {
  if (isAxiosError(error)) {
    const description =
      error.response?.data?.errors?.[0]?.description ?? error.response?.data?.message ?? error.message;
    return new ExternalServiceError(`Falha ao ${action} na Asaas: ${description}`, {
      status: error.response?.status,
      data: error.response?.data,
    });
  }
  return new ExternalServiceError(`Falha ao ${action} na Asaas: ${(error as Error)?.message ?? "erro desconhecido"}`);
}
