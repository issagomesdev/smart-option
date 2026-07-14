import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { livenessRouter } from "./liveness.routes";

function buildApp() {
  const app = express();
  app.use("/health", livenessRouter);
  return app;
}

describe("GET /health", () => {
  it("responde 200 com status/uptime/versão/ambiente/timestamp, sem checar dependências", async () => {
    const response = await request(buildApp()).get("/health");

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      success: true,
      data: {
        status: "ok",
        environment: "test",
        version: expect.any(String),
        uptime: expect.any(Number),
        timestamp: expect.any(String),
      },
    });
  });
});
