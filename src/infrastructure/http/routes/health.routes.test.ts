import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../database/client", () => ({
  checkDatabaseConnection: vi.fn(),
}));
vi.mock("../../cache/redis", () => ({
  checkRedisConnection: vi.fn(),
}));

import { checkDatabaseConnection } from "../../database/client";
import { checkRedisConnection } from "../../cache/redis";
import { healthRouter } from "./health.routes";

function buildApp() {
  const app = express();
  app.use("/api/health", healthRouter);
  return app;
}

describe("GET /api/health", () => {
  beforeEach(() => {
    vi.mocked(checkDatabaseConnection).mockReset();
    vi.mocked(checkRedisConnection).mockReset();
  });

  it("retorna 200 e status ok quando banco e redis estão disponíveis", async () => {
    vi.mocked(checkDatabaseConnection).mockResolvedValue(true);
    vi.mocked(checkRedisConnection).mockResolvedValue(true);

    const response = await request(buildApp()).get("/api/health");

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      success: true,
      data: { status: "ok", dependencies: { database: "up", redis: "up" } },
    });
  });

  it("retorna 503 e status degraded quando uma dependência está fora do ar", async () => {
    vi.mocked(checkDatabaseConnection).mockResolvedValue(true);
    vi.mocked(checkRedisConnection).mockResolvedValue(false);

    const response = await request(buildApp()).get("/api/health");

    expect(response.status).toBe(503);
    expect(response.body).toMatchObject({
      success: true,
      data: { status: "degraded", dependencies: { database: "up", redis: "down" } },
    });
  });
});
