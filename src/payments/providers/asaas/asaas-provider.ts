import {
  CreateCustomerInput,
  CreateCustomerResult,
  CreatePixChargeInput,
  CreatePixChargeResult,
  CreateTransferInput,
  CreateTransferResult,
  PaymentProvider,
  WebhookEvent,
} from "../../interfaces/payment-provider";
import { AsaasCustomerService } from "./customer.service";
import { AsaasPaymentService } from "./payment.service";
import { AsaasPixService } from "./pix.service";
import { AsaasTransferService } from "./transfer.service";
import { AsaasWebhookService } from "./webhook.service";
import { AsaasNotificationService } from "./notification.service";

export class AsaasProvider implements PaymentProvider {
  constructor(
    private readonly customerService = new AsaasCustomerService(),
    private readonly paymentService = new AsaasPaymentService(),
    private readonly pixService = new AsaasPixService(),
    private readonly transferService = new AsaasTransferService(),
    private readonly webhookService = new AsaasWebhookService(),
    private readonly notificationService = new AsaasNotificationService(),
  ) {}

  async createCustomer(input: CreateCustomerInput): Promise<CreateCustomerResult> {
    const result = await this.customerService.createCustomer(input);
    await this.notificationService.disableCustomerNotifications(result.externalCustomerId);
    return result;
  }

  async createPixCharge(input: CreatePixChargeInput): Promise<CreatePixChargeResult> {
    const payment = await this.paymentService.createPixPayment(input);
    const qrCode = await this.pixService.getQrCode(payment.id);

    return {
      externalId: payment.id,
      status: payment.status,
      qrCodeImageBase64: qrCode.encodedImage,
      qrCodePayload: qrCode.payload,
      expiresAt: new Date(qrCode.expirationDate),
    };
  }

  async createTransfer(input: CreateTransferInput): Promise<CreateTransferResult> {
    const transfer = await this.transferService.createPixTransfer({
      amount: input.amount,
      pixKey: input.pixKey,
      description: input.description,
      externalReference: input.externalReference,
    });

    return { externalId: transfer.id, status: transfer.status };
  }

  verifyWebhookSignature(signatureHeader: string | undefined): boolean {
    return this.webhookService.verifySignature(signatureHeader);
  }

  parseWebhookEvent(payload: unknown): WebhookEvent {
    return this.webhookService.parseWebhookEvent(payload);
  }
}
