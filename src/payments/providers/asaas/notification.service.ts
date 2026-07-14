import { asaasHttpClient } from "./http-client";
import { logger } from "../../../shared/logger";

interface AsaasCustomerNotification {
  id: string;
  emailEnabledForProvider: boolean;
  smsEnabledForProvider: boolean;
  whatsappEnabledForProvider: boolean;
}

/**
 * Por padrão a Asaas envia seus próprios e-mails/SMS ao cliente sobre status
 * de cobrança — como o bot já assume toda a comunicação com o usuário,
 * desligamos isso após criar o customer. Best-effort: falhar aqui não pode
 * impedir o cadastro nem a cobrança, por isso só loga um aviso.
 */
export class AsaasNotificationService {
  async disableCustomerNotifications(customerExternalId: string): Promise<void> {
    try {
      const { data } = await asaasHttpClient.get<{ data: AsaasCustomerNotification[] }>(
        `/customers/${customerExternalId}/notifications`,
      );

      await Promise.all(
        data.data.map((notification) =>
          asaasHttpClient.put(`/notifications/${notification.id}`, {
            emailEnabledForProvider: false,
            smsEnabledForProvider: false,
            whatsappEnabledForProvider: false,
          }),
        ),
      );
    } catch (error) {
      logger.warn({ err: error, customerExternalId }, "Não foi possível desativar notificações automáticas da Asaas");
    }
  }
}
