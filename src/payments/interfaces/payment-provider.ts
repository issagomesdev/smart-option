export type PixKeyType = "CPF" | "CNPJ" | "EMAIL" | "PHONE" | "EVP";

export interface CreateCustomerInput {
  name: string;
  email: string;
  /** Opcional: a coleta de CPF no cadastro do bot ainda não existe para todos os usuários (retrofit da Fase 4/7). */
  cpfCnpj?: string;
  phone?: string;
  externalReference: string;
}

export interface CreateCustomerResult {
  externalCustomerId: string;
}

export interface CreatePixChargeInput {
  customerExternalId: string;
  amount: number;
  description: string;
  externalReference: string;
}

export interface CreatePixChargeResult {
  externalId: string;
  status: string;
  qrCodeImageBase64: string;
  qrCodePayload: string;
  expiresAt: Date;
}

export interface CreateTransferInput {
  amount: number;
  pixKey: string;
  description: string;
  externalReference: string;
}

export interface CreateTransferResult {
  externalId: string;
  status: string;
}

export type WebhookEventCategory = "payment" | "transfer" | "unknown";

export interface WebhookEvent {
  externalEventId: string;
  eventType: string;
  category: WebhookEventCategory;
  resourceExternalId: string | null;
  status: string;
  raw: unknown;
}

/**
 * Porta de saída do módulo financeiro. Nenhuma outra parte da aplicação deve
 * importar um provider concreto (ex.: Asaas) diretamente — sempre através
 * desta interface, obtida via `payment.factory.ts`.
 */
export interface PaymentProvider {
  createCustomer(input: CreateCustomerInput): Promise<CreateCustomerResult>;
  createPixCharge(input: CreatePixChargeInput): Promise<CreatePixChargeResult>;
  createTransfer(input: CreateTransferInput): Promise<CreateTransferResult>;
  verifyWebhookSignature(signatureHeader: string | undefined): boolean;
  parseWebhookEvent(payload: unknown): WebhookEvent;
}
