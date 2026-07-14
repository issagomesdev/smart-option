import { asaasHttpClient } from "./http-client";
import { toAsaasError } from "./errors";

export interface AsaasPixQrCodeResponse {
  encodedImage: string;
  payload: string;
  expirationDate: string;
}

export class AsaasPixService {
  async getQrCode(paymentExternalId: string): Promise<AsaasPixQrCodeResponse> {
    try {
      const { data } = await asaasHttpClient.get<AsaasPixQrCodeResponse>(
        `/payments/${paymentExternalId}/pixQrCode`,
      );
      return data;
    } catch (error) {
      throw toAsaasError(error, "obter QR Code PIX");
    }
  }
}
