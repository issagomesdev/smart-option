import Redis from "ioredis";
import { env } from "../../config/env";
import { logger } from "../../shared/logger";

export const redis = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
  lazyConnect: true,
});

redis.on("error", (err) => {
  logger.error({ err }, "Erro na conexão com o Redis");
});

export async function checkRedisConnection(): Promise<boolean> {
  try {
    if (redis.status === "wait" || redis.status === "end") {
      await redis.connect();
    }
    const pong = await redis.ping();
    return pong === "PONG";
  } catch (err) {
    logger.error({ err }, "Falha no healthcheck do Redis");
    return false;
  }
}
