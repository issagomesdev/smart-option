import { asaasHttpClient } from "./http-client";
import { toAsaasError } from "./errors";
import { inferPixKeyType } from "./pix-key";

export interface CreateAsaasTransferInput {
  amount: number;
  pixKey: string;
  description: string;
  externalReference: string;
}

export interface AsaasTransferResponse {
  id: string;
  status: string;
}

export class AsaasTransferService {
  async createPixTransfer(input: CreateAsaasTransferInput): Promise<AsaasTransferResponse> {
    try {
      const { data } = await asaasHttpClient.post<AsaasTransferResponse>("/transfers", {
        value: input.amount,
        pixAddressKey: input.pixKey,
        pixAddressKeyType: inferPixKeyType(input.pixKey),
        description: input.description,
        externalReference: input.externalReference,
      });

      return data;
    } catch (error) {
      throw toAsaasError(error, "criar transferência PIX");
    }
  }
}
