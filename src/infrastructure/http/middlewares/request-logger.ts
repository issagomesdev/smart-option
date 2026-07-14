import { randomUUID } from "node:crypto";
import pinoHttp from "pino-http";
import { logger } from "../../../shared/logger";

function firstHeaderValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export const requestLogger = pinoHttp({
  logger,
  genReqId: (req, res) => {
    const requestId = firstHeaderValue(req.headers["x-request-id"]) ?? randomUUID();
    res.setHeader("x-request-id", requestId);
    return requestId;
  },
  customProps: (req) => ({
    correlationId: firstHeaderValue(req.headers["x-correlation-id"]) ?? req.id,
  }),
  customLogLevel: (_req, res, err) => {
    if (err || res.statusCode >= 500) return "error";
    if (res.statusCode >= 400) return "warn";
    return "info";
  },
});
