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

vi.mock("../../services/roles.service", () => ({
  RolesService: {
    list: vi.fn(),
    getById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

import { RolesService } from "../../services/roles.service";
import rolesRoute from "./roles.routes";

/**
 * Prova a fiação HTTP real de `/api/roles`, não a lógica de negócio (já
 * coberta por `roles.service.test.ts`) — `RolesService` é mockado. O ponto
 * central desta suíte: `GET /` aceita `staff.manage` OU `roles.manage`
 * (achado da Fase 5 parte 7), mas `GET /:id` e toda escrita exigem
 * `roles.manage` estritamente (parte 8) — duas regras de autorização
 * diferentes dentro do mesmo arquivo de rota, fáceis de trocar sem querer
 * numa edição futura sem um teste que prove a distinção rota a rota.
 */
function buildApp() {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    // @ts-expect-error simplificação do pino-http real, só o suficiente para o error handler funcionar no teste
    req.log = { error: vi.fn(), warn: vi.fn() };
    req.id = "test-request-id";
    next();
  });
  app.use("/api/roles", authorize(), rolesRoute);
  app.use(errorHandler);
  return app;
}

describe("/api/roles (wiring HTTP — banco real para autenticação, RolesService mockado)", () => {
  let staffManageOnlyId: number;
  let rolesManageOnlyId: number;
  let neitherId: number;
  let staffManageOnlyToken: string;
  let rolesManageOnlyToken: string;
  let neitherToken: string;
  const testRoleIds: number[] = [];

  beforeAll(async () => {
    const stamp = Date.now();

    const [staffManageRole] = await db
      .insert(roles)
      .values({ name: `Roles Routes Wiring Staff-Manage ${stamp}`, permissions: ["staff.manage"] })
      .$returningId();
    testRoleIds.push(staffManageRole.id);

    const [rolesManageRole] = await db
      .insert(roles)
      .values({ name: `Roles Routes Wiring Roles-Manage ${stamp}`, permissions: ["roles.manage"] })
      .$returningId();
    testRoleIds.push(rolesManageRole.id);

    const [staffManageOnly] = await db
      .insert(staffUsers)
      .values({
        name: "Wiring",
        surname: "StaffManageOnly",
        email: `roles-routes-wiring-staff-${stamp}@test.local`,
        password: "unused-in-this-test",
        roleId: staffManageRole.id,
      })
      .$returningId();
    staffManageOnlyId = staffManageOnly.id;
    staffManageOnlyToken = jwt.sign({ userId: staffManageOnlyId }, env.SECRET_KEY, { expiresIn: "15m" });

    const [rolesManageOnly] = await db
      .insert(staffUsers)
      .values({
        name: "Wiring",
        surname: "RolesManageOnly",
        email: `roles-routes-wiring-roles-${stamp}@test.local`,
        password: "unused-in-this-test",
        roleId: rolesManageRole.id,
      })
      .$returningId();
    rolesManageOnlyId = rolesManageOnly.id;
    rolesManageOnlyToken = jwt.sign({ userId: rolesManageOnlyId }, env.SECRET_KEY, { expiresIn: "15m" });

    const [neither] = await db
      .insert(staffUsers)
      .values({
        name: "Wiring",
        surname: "Neither",
        email: `roles-routes-wiring-neither-${stamp}@test.local`,
        password: "unused-in-this-test",
        roleId: 2,
      })
      .$returningId();
    neitherId = neither.id;
    neitherToken = jwt.sign({ userId: neitherId }, env.SECRET_KEY, { expiresIn: "15m" });
  });

  afterAll(async () => {
    await db.delete(staffUsers).where(eq(staffUsers.id, staffManageOnlyId));
    await db.delete(staffUsers).where(eq(staffUsers.id, rolesManageOnlyId));
    await db.delete(staffUsers).where(eq(staffUsers.id, neitherId));
    for (const roleId of testRoleIds) {
      await db.delete(roles).where(eq(roles.id, roleId));
    }
  });

  afterEach(() => {
    vi.mocked(RolesService.list).mockReset();
    vi.mocked(RolesService.getById).mockReset();
    vi.mocked(RolesService.create).mockReset();
    vi.mocked(RolesService.update).mockReset();
    vi.mocked(RolesService.delete).mockReset();
  });

  describe("GET /api/roles (lista) — aceita staff.manage OU roles.manage", () => {
    it("permite com só staff.manage", async () => {
      vi.mocked(RolesService.list).mockResolvedValue([]);
      const response = await request(buildApp()).get("/api/roles").set("Authorization", `Bearer ${staffManageOnlyToken}`);
      expect(response.status).toBe(200);
    });

    it("permite com só roles.manage", async () => {
      vi.mocked(RolesService.list).mockResolvedValue([]);
      const response = await request(buildApp()).get("/api/roles").set("Authorization", `Bearer ${rolesManageOnlyToken}`);
      expect(response.status).toBe(200);
    });

    it("recusa com 403 quando não tem nenhuma das duas", async () => {
      const response = await request(buildApp()).get("/api/roles").set("Authorization", `Bearer ${neitherToken}`);
      expect(response.status).toBe(403);
      expect(RolesService.list).not.toHaveBeenCalled();
    });

    it("recusa com 401 sem autenticação nenhuma", async () => {
      const response = await request(buildApp()).get("/api/roles");
      expect(response.status).toBe(401);
    });
  });

  describe("GET /api/roles/:id (detalhe) — exige roles.manage estritamente", () => {
    it("recusa com 403 para quem só tem staff.manage (diferente da lista)", async () => {
      const response = await request(buildApp())
        .get(`/api/roles/${staffManageOnlyId}`)
        .set("Authorization", `Bearer ${staffManageOnlyToken}`);
      expect(response.status).toBe(403);
      expect(RolesService.getById).not.toHaveBeenCalled();
    });

    it("permite para quem tem roles.manage", async () => {
      vi.mocked(RolesService.getById).mockResolvedValue({ id: 1, name: "admin" } as never);
      const response = await request(buildApp())
        .get(`/api/roles/${rolesManageOnlyId}`)
        .set("Authorization", `Bearer ${rolesManageOnlyToken}`);
      expect(response.status).toBe(200);
      expect(RolesService.getById).toHaveBeenCalledWith(rolesManageOnlyId);
    });
  });

  describe("POST /api/roles — exige roles.manage estritamente", () => {
    it("recusa com 403 para quem só tem staff.manage", async () => {
      const response = await request(buildApp())
        .post("/api/roles")
        .set("Authorization", `Bearer ${staffManageOnlyToken}`)
        .send({ name: "novo-papel", permissions: [] });
      expect(response.status).toBe(403);
      expect(RolesService.create).not.toHaveBeenCalled();
    });

    it("recusa corpo inválido (sem nome) com 400 antes de chamar o service", async () => {
      const response = await request(buildApp())
        .post("/api/roles")
        .set("Authorization", `Bearer ${rolesManageOnlyToken}`)
        .send({ permissions: [] });
      expect(response.status).toBe(400);
      expect(RolesService.create).not.toHaveBeenCalled();
    });

    it("corpo válido chama RolesService.create com o body e as permissões do ator", async () => {
      vi.mocked(RolesService.create).mockResolvedValue({ id: 50 } as never);
      const response = await request(buildApp())
        .post("/api/roles")
        .set("Authorization", `Bearer ${rolesManageOnlyToken}`)
        .send({ name: "novo-papel", permissions: ["roles.manage"] });

      expect(response.status).toBe(201);
      expect(RolesService.create).toHaveBeenCalledWith({ name: "novo-papel", permissions: ["roles.manage"] }, ["roles.manage"]);
    });
  });

  describe("PATCH /api/roles/:id — exige roles.manage estritamente", () => {
    it("chama RolesService.update com id, body e as permissões do ator", async () => {
      vi.mocked(RolesService.update).mockResolvedValue({ id: staffManageOnlyId } as never);
      const response = await request(buildApp())
        .patch(`/api/roles/${staffManageOnlyId}`)
        .set("Authorization", `Bearer ${rolesManageOnlyToken}`)
        .send({ name: "renomeado", permissions: ["roles.manage"] });

      expect(response.status).toBe(200);
      expect(RolesService.update).toHaveBeenCalledWith(
        staffManageOnlyId,
        { name: "renomeado", permissions: ["roles.manage"] },
        ["roles.manage"],
      );
    });
  });

  describe("DELETE /api/roles/:id — exige roles.manage estritamente", () => {
    it("chama RolesService.delete com o id do param", async () => {
      vi.mocked(RolesService.delete).mockResolvedValue({ status: true, message: "ok" });
      const response = await request(buildApp())
        .delete(`/api/roles/${staffManageOnlyId}`)
        .set("Authorization", `Bearer ${rolesManageOnlyToken}`);

      expect(response.status).toBe(200);
      expect(RolesService.delete).toHaveBeenCalledWith(staffManageOnlyId);
    });
  });
});
