import { Router } from "express";
import packageJson from "../../../../package.json";
import { env } from "../../../config/env";
import { ok } from "../../../shared/http/response";

export const livenessRouter = Router();

/**
 * `GET /health` — liveness simples, sem checar dependências (isso é
 * `GET /api/health`). Existe para validação externa rápida de infraestrutura
 * (ex.: o Cloudflare Tunnel em desenvolvimento) — precisa responder mesmo se
 * o banco/Redis estiverem temporariamente indisponíveis.
 */
livenessRouter.get("/", (_req, res) => {
  ok(res, {
    status: "ok",
    uptime: process.uptime(),
    version: packageJson.version,
    environment: env.NODE_ENV,
    timestamp: new Date().toISOString(),
  });
});
