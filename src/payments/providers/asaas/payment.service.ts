import { asaasHttpClient } from "./http-client";
import { toAsaasError } from "./errors";

export interface CreateAsaasPixPaymentInput {
  customerExternalId: string;
  amount: number;
  description: string;
  externalReference: string;
}

export interface AsaasPaymentResponse {
  id: string;
  status: string;
}

function todayAsDueDate(): string {
  return new Date().toISOString().slice(0, 10);
}

export class AsaasPaymentService {
  async createPixPayment(input: CreateAsaasPixPaymentInput): Promise<AsaasPaymentResponse> {
    try {
      const { data } = await asaasHttpClient.post<AsaasPaymentResponse>("/payments", {
        customer: input.customerExternalId,
        billingType: "PIX",
        value: input.amount,
        dueDate: todayAsDueDate(),
        description: input.description,
        externalReference: input.externalReference,
      });

      return data;
    } catch (error) {
      throw toAsaasError(error, "criar cobrança PIX");
    }
  }
}
