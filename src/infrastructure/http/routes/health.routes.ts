import { Router } from "express";
import { ok } from "../../../shared/http/response";
import { checkDatabaseConnection } from "../../database/client";
import { checkRedisConnection } from "../../cache/redis";

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
      timestamp: new Date().toISOString(),
    },
    healthy ? 200 : 503,
  );
});
