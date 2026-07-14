import { asaasHttpClient } from "./http-client";
import { toAsaasError } from "./errors";
import { CreateCustomerInput, CreateCustomerResult } from "../../interfaces/payment-provider";

interface AsaasCustomerResponse {
  id: string;
}

export class AsaasCustomerService {
  async createCustomer(input: CreateCustomerInput): Promise<CreateCustomerResult> {
    try {
      const { data } = await asaasHttpClient.post<AsaasCustomerResponse>("/customers", {
        name: input.name,
        email: input.email,
        ...(input.cpfCnpj ? { cpfCnpj: input.cpfCnpj } : {}),
        ...(input.phone ? { mobilePhone: input.phone } : {}),
        externalReference: input.externalReference,
      });

      return { externalCustomerId: data.id };
    } catch (error) {
      throw toAsaasError(error, "criar cliente");
    }
  }
}
