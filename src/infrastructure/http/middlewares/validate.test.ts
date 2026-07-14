import express from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { validate } from "./validate";
import { errorHandler } from "./error-handler";

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    // @ts-expect-error simplificação do pino-http real, só o suficiente para o error handler funcionar no teste
    req.log = { error: vi.fn(), warn: vi.fn() };
    req.id = "test-request-id";
    next();
  });

  app.post(
    "/echo/:id",
    validate({ body: z.object({ name: z.string().min(1) }), params: z.object({ id: z.coerce.number() }) }),
    (req, res) => {
      res.json({ body: req.body, params: req.params });
    },
  );

  app.use(errorHandler);
  return app;
}

describe("validate middleware", () => {
  it("passa adiante body e params já parseados/coeridos quando válidos", async () => {
    const response = await request(buildApp()).post("/echo/42").send({ name: "Ada" });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ body: { name: "Ada" }, params: { id: 42 } });
  });

  it("responde 400 com detalhes dos campos inválidos quando o body falha na validação", async () => {
    const response = await request(buildApp()).post("/echo/42").send({ name: "" });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
    expect(response.body.error.details.issues).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "name" })]),
    );
  });

  it("responde 400 quando os params não coagem para o tipo esperado", async () => {
    const response = await request(buildApp()).post("/echo/not-a-number").send({ name: "Ada" });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
  });
});
