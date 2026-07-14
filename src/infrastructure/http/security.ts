import compression from "compression";
import { CorsOptions } from "cors";
import { RequestHandler } from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import { RedisStore } from "rate-limit-redis";
import { env } from "../../config/env";
import { ForbiddenError } from "../../shared/errors";
import { redis } from "../cache/redis";

export const corsOptions: CorsOptions = {
  origin(origin, callback) {
    // Requisições sem header Origin (server-to-server, webhooks, curl) não são
    // afetadas por CORS — a política só se aplica a navegadores.
    if (!origin || env.CORS_ALLOWED_ORIGINS.includes(origin)) {
      callback(null, true);
      return;
    }
    callback(new ForbiddenError(`Origem não permitida pelo CORS: ${origin}`));
  },
  methods: ["GET", "HEAD", "PUT", "PATCH", "POST", "DELETE"],
  exposedHeaders: ["x-request-id"],
  credentials: true,
};

export const helmetMiddleware = helmet();

export const compressionMiddleware = compression();

/**
 * Limite global aplicado a toda a API. Rotas sensíveis (login, webhooks)
 * devem compor um limitador mais restrito próprio nas fases seguintes.
 */
export function createRateLimiter(options?: { windowMs?: number; max?: number; prefix?: string }): RequestHandler {
  return rateLimit({
    windowMs: options?.windowMs ?? env.RATE_LIMIT_WINDOW_MS,
    limit: options?.max ?? env.RATE_LIMIT_MAX,
    standardHeaders: true,
    legacyHeaders: false,
    store: new RedisStore({
      prefix: options?.prefix ?? "rl:",
      sendCommand: (...args: string[]) => redis.call(...(args as [string, ...string[]])) as any,
    }),
  });
}

export const globalRateLimiter = createRateLimiter();
