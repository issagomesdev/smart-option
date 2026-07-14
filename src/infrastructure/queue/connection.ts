import type { ConnectionOptions } from "bullmq";
import { env } from "../../config/env";

/**
 * Opções de conexão (não uma instância de `ioredis`) para as filas/workers
 * BullMQ. Passar um objeto de opções em vez de uma instância evita um
 * conflito de tipos entre a versão do `ioredis` do projeto e a versão que o
 * BullMQ empacota internamente (`bullmq/node_modules/ioredis`, geralmente
 * uma patch version diferente) — o BullMQ cria sua própria conexão a partir
 * daqui. `maxRetriesPerRequest: null` é exigido pelo BullMQ.
 */
export const queueConnection: ConnectionOptions = {
  url: env.REDIS_URL,
  maxRetriesPerRequest: null,
};
