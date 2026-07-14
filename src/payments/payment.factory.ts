import { PaymentProvider } from "./interfaces/payment-provider";
import { AsaasProvider } from "./providers/asaas/asaas-provider";

let provider: PaymentProvider | null = null;

/**
 * Único ponto de obtenção de um `PaymentProvider`. Hoje só existe a Asaas,
 * mas o resto da aplicação depende da interface, não da implementação —
 * trocar (ou adicionar) gateway não deveria exigir tocar em nenhum
 * consumidor além desta função.
 */
export function getPaymentProvider(): PaymentProvider {
  if (!provider) {
    provider = new AsaasProvider();
  }
  return provider;
}
