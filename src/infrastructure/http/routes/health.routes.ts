import { Router } from "express";
import { ok } from "../../../shared/http/response";
import { checkDatabaseConnection } from "../../database/client";
import { checkRedisConnection } from "../../cache/redis";
import { isDemo } from "../../../config/demo";

export const healthRouter = Router();

healthRouter.get("/", async (_req, res) => {
  const [databaseUp, redisUp] = await Promise.all([checkDatabaseConnection(), checkRedisConnection()]);
  const healthy = databaseUp && redisUp;

  ok(
    res,
    {
      status: healthy ? "ok" : "degraded",
      dependencies: {
        database: databaseUp ? "up" : "down",
        redis: redisUp ? "up" : "down",
      },
      // Exposto publicamente de propósito: a tela de login (que é anônima, por definição) precisa
      // saber se deve oferecer o botão "Entrar como visitante", e o painel exibe um selo "DEMO MODE"
      // bem visível de qualquer forma — não é informação sensível, é o contrário disso.
      demo: isDemo,
      timestamp: new Date().toISOString(),
    },
    healthy ? 200 : 503,
  );
});
