import express from "express";
import jwt from "jsonwebtoken";
import request from "supertest";
import { eq } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { db } from "../../infrastructure/database/client";
import { roles, staffUsers } from "../../infrastructure/database/schema";
import { env } from "../../config/env";
import { errorHandler } from "../../infrastructure/http/middlewares/error-handler";
import { authorize } from "../middlewares/auth.interceptor";

vi.mock("../../services/plans.service", () => ({
  PlansService: {
    list: vi.fn(),
    getById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

import { PlansService } from "../../services/plans.service";
import plansRoute from "./plans.routes";

/**
 * Fiação HTTP de `/api/plans` (a lógica está coberta por `plans.service.test.ts`, aqui o service é
 * mockado). O ponto da suíte é a assimetria deliberada do router: leitura aberta a qualquer staff
 * autenticado — mesma convenção do dashboard/auditoria —, escrita exigindo `plans.manage`. É fácil
 * gatear o mount inteiro por engano numa edição futura e derrubar a leitura sem perceber.
 */
function buildApp() {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    // @ts-expect-error simplificação do pino-http real, só o suficiente para o error handler no teste
    req.log = { error: vi.fn(), warn: vi.fn() };
    req.id = "test-request-id";
    next();
  });
  app.use("/api/plans", authorize(), plansRoute);
  app.use(errorHandler);
  return app;
}

const VALID_BODY = {
  name: "Plano de Teste",
  description: "Corpo válido para o DTO.",
  price: 100,
  earningsMonthly: 5,
  purchaseType: "auto" as const,
};

describe("/api/plans (wiring HTTP — banco real para autenticação, PlansService mockado)", () => {
  let managerId: number;
  let readerId: number;
  let managerToken: string;
  let readerToken: string;
  const testRoleIds: number[] = [];

  beforeAll(async () => {
    const stamp = Date.now();

    const [managerRole] = await db
      .insert(roles)
      .values({ name: `Plans Routes Manage ${stamp}`, permissions: ["plans.manage"] })
      .$returningId();
    testRoleIds.push(managerRole.id);

    // Papel sem NENHUMA permissão — prova que leitura de planos não exige nada além de autenticar.
    const [readerRole] = await db
      .insert(roles)
      .values({ name: `Plans Routes Reader ${stamp}`, permissions: [] })
      .$returningId();
    testRoleIds.push(readerRole.id);

    const [manager] = await db
      .insert(staffUsers)
      .values({
        name: "Wiring",
        surname: "PlansManager",
        email: `plans-routes-manager-${stamp}@test.local`,
        password: "unused-in-this-test",
        roleId: managerRole.id,
      })
      .$returningId();
    managerId = manager.id;
    managerToken = jwt.sign({ userId: managerId }, env.SECRET_KEY, { expiresIn: "15m" });

    const [reader] = await db
      .insert(staffUsers)
      .values({
        name: "Wiring",
        surname: "PlansReader",
        email: `plans-routes-reader-${stamp}@test.local`,
        password: "unused-in-this-test",
        roleId: readerRole.id,
      })
      .$returningId();
    readerId = reader.id;
    readerToken = jwt.sign({ userId: readerId }, env.SECRET_KEY, { expiresIn: "15m" });
  });

  afterAll(async () => {
    await db.delete(staffUsers).where(eq(staffUsers.id, managerId));
    await db.delete(staffUsers).where(eq(staffUsers.id, readerId));
    for (const roleId of testRoleIds) await db.delete(roles).where(eq(roles.id, roleId));
  });

  afterEach(() => {
    vi.mocked(PlansService.list).mockReset();
    vi.mocked(PlansService.getById).mockReset();
    vi.mocked(PlansService.create).mockReset();
    vi.mocked(PlansService.update).mockReset();
    vi.mocked(PlansService.delete).mockReset();
  });

  it("exige autenticação em qualquer rota", async () => {
    await request(buildApp()).get("/api/plans").expect(401);
  });

  describe("leitura — aberta a qualquer staff autenticado", () => {
    it("GET / permite mesmo sem nenhuma permissão", async () => {
      vi.mocked(PlansService.list).mockResolvedValue({
        data: [],
        pagination: { page: 1, limit: 20, total: 0, totalPages: 1 },
      });

      await request(buildApp()).get("/api/plans").set("Authorization", `Bearer ${readerToken}`).expect(200);
      expect(PlansService.list).toHaveBeenCalled();
    });

    it("GET /:id permite mesmo sem nenhuma permissão", async () => {
      vi.mocked(PlansService.getById).mockResolvedValue({
        id: 1,
        name: "bronze",
        description: "…",
        price: 97,
        earningsMonthly: 4,
        purchaseType: "auto",
        isSystem: true,
        isActive: true,
        subscriberCount: 0,
      });

      await request(buildApp()).get("/api/plans/1").set("Authorization", `Bearer ${readerToken}`).expect(200);
      expect(PlansService.getById).toHaveBeenCalledWith(1);
    });

    it("GET /:id rejeita id não numérico pelo DTO, sem chamar o service", async () => {
      await request(buildApp()).get("/api/plans/abc").set("Authorization", `Bearer ${readerToken}`).expect(400);
      expect(PlansService.getById).not.toHaveBeenCalled();
    });
  });

  describe("escrita — exige plans.manage", () => {
    it("POST / responde 403 sem a permissão, sem chamar o service", async () => {
      await request(buildApp())
        .post("/api/plans")
        .set("Authorization", `Bearer ${readerToken}`)
        .send(VALID_BODY)
        .expect(403);

      expect(PlansService.create).not.toHaveBeenCalled();
    });

    it("POST / responde 201 com a permissão", async () => {
      vi.mocked(PlansService.create).mockResolvedValue({
        ...VALID_BODY,
        id: 10,
        isSystem: false,
        isActive: true,
        subscriberCount: 0,
      });

      await request(buildApp())
        .post("/api/plans")
        .set("Authorization", `Bearer ${managerToken}`)
        .send(VALID_BODY)
        .expect(201);

      expect(PlansService.create).toHaveBeenCalled();
    });

    it("POST / rejeita corpo inválido pelo DTO antes de chegar ao service", async () => {
      await request(buildApp())
        .post("/api/plans")
        .set("Authorization", `Bearer ${managerToken}`)
        .send({ ...VALID_BODY, name: "", earningsMonthly: 5000 })
        .expect(400);

      expect(PlansService.create).not.toHaveBeenCalled();
    });

    it("PATCH /:id responde 403 sem a permissão", async () => {
      await request(buildApp())
        .patch("/api/plans/1")
        .set("Authorization", `Bearer ${readerToken}`)
        .send(VALID_BODY)
        .expect(403);

      expect(PlansService.update).not.toHaveBeenCalled();
    });

    it("DELETE /:id responde 403 sem a permissão; com ela, chama o service", async () => {
      await request(buildApp()).delete("/api/plans/1").set("Authorization", `Bearer ${readerToken}`).expect(403);
      expect(PlansService.delete).not.toHaveBeenCalled();

      vi.mocked(PlansService.delete).mockResolvedValue({ status: true, message: "Plano excluído com sucesso" });
      await request(buildApp()).delete("/api/plans/1").set("Authorization", `Bearer ${managerToken}`).expect(200);
      expect(PlansService.delete).toHaveBeenCalledWith(1);
    });
  });
});
