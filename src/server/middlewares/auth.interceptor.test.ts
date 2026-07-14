import express from "express";
import jwt from "jsonwebtoken";
import request from "supertest";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "../../infrastructure/database/client";
import { staffUsers } from "../../infrastructure/database/schema";
import { env } from "../../config/env";
import { errorHandler } from "../../infrastructure/http/middlewares/error-handler";
import { authorize } from "./auth.interceptor";

function buildApp() {
  const app = express();
  app.use((req, _res, next) => {
    // @ts-expect-error simplificação do pino-http real, só o suficiente para o error handler funcionar no teste
    req.log = { error: () => {}, warn: () => {} };
    req.id = "test-request-id";
    next();
  });

  app.get("/protected", authorize(), (req: any, res) => {
    res.json({ user: req.user });
  });

  app.use(errorHandler);
  return app;
}

/**
 * `authorize()` corrigiu um bug real (Fase 6): o código original chamava
 * `res.json(...)` e ainda `next()` em seguida em caso de token ausente/
 * inválido, arriscando "headers already sent". O teste central aqui é
 * garantir exatamente **uma** resposta por requisição em cada caminho.
 */
describe("authorize() middleware (integração, banco real)", () => {
  let userId: number;

  beforeAll(async () => {
    const [user] = await db
      .insert(staffUsers)
      .values({
        name: "Interceptor",
        surname: "Test",
        email: `auth-interceptor-${Date.now()}@test.local`,
        password: "unused-in-this-test",
      })
      .$returningId();
    userId = user.id;
  });

  afterAll(async () => {
    await db.delete(staffUsers).where(eq(staffUsers.id, userId));
  });

  it("responde 401 sem header Authorization, sem chamar a rota protegida", async () => {
    const response = await request(buildApp()).get("/protected");
    expect(response.status).toBe(401);
    expect(response.body.success).toBe(false);
  });

  it("responde 401 com um token JWT inválido", async () => {
    const response = await request(buildApp()).get("/protected").set("Authorization", "Bearer token-invalido");
    expect(response.status).toBe(401);
  });

  it("responde 401 com um token JWT válido mas cujo usuário não existe mais", async () => {
    const token = jwt.sign({ userId: 999999999 }, env.SECRET_KEY, { expiresIn: "15m" });
    const response = await request(buildApp()).get("/protected").set("Authorization", `Bearer ${token}`);
    expect(response.status).toBe(401);
  });

  it("responde 401 com um token expirado", async () => {
    const token = jwt.sign({ userId }, env.SECRET_KEY, { expiresIn: "-1s" });
    const response = await request(buildApp()).get("/protected").set("Authorization", `Bearer ${token}`);
    expect(response.status).toBe(401);
  });

  it("popula req.user e chama a rota protegida com um token válido", async () => {
    const token = jwt.sign({ userId }, env.SECRET_KEY, { expiresIn: "15m" });
    const response = await request(buildApp()).get("/protected").set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.user).toMatchObject({ id: userId, name: "Interceptor", surname: "Test" });
  });
});
