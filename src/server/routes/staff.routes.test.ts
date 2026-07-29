import express from "express";
import jwt from "jsonwebtoken";
import request from "supertest";
import { eq } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { db } from "../../infrastructure/database/client";
import { roles, staffUsers } from "../../infrastructure/database/schema";
import { env } from "../../config/env";
import { errorHandler } from "../../infrastructure/http/middlewares/error-handler";
import { authorize, requirePermission } from "../middlewares/auth.interceptor";

vi.mock("../../services/staff.service", () => ({
  StaffService: {
    list: vi.fn(),
    getById: vi.fn(),
    create: vi.fn(),
    reassignRole: vi.fn(),
    remove: vi.fn(),
  },
}));

import { StaffService } from "../../services/staff.service";
import staffRoute from "./staff.routes";

/**
 * Prova a fiação HTTP real de `/api/staff`, não a lógica de negócio (já
 * coberta por `staff.service.test.ts`) — o `StaffService` é mockado aqui de
 * propósito. O ponto central: `requirePermission('staff.manage')` é aplicado
 * no *mount* deste router (`server/routes/index.ts`), não dentro do arquivo
 * `staff.routes.ts` em si — é o único dos recursos RBAC "tudo ou nada" onde
 * o gate não é visível abrindo o arquivo da rota, então é o lugar mais fácil
 * de uma regressão futura (alguém remove o gate do mount sem perceber)
 * passar despercebida sem um teste que reproduza o mount exato.
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
  app.use("/api/staff", authorize(), requirePermission("staff.manage"), staffRoute);
  app.use(errorHandler);
  return app;
}

describe("/api/staff (wiring HTTP — banco real para autenticação, StaffService mockado)", () => {
  let withPermissionId: number;
  let withoutPermissionId: number;
  let withPermissionToken: string;
  let withoutPermissionToken: string;
  let testRoleId: number;

  beforeAll(async () => {
    const stamp = Date.now();
    const [role] = await db
      .insert(roles)
      .values({ name: `Staff Routes Wiring Test ${stamp}`, permissions: ["staff.manage"] })
      .$returningId();
    testRoleId = role.id;

    const [withPermission] = await db
      .insert(staffUsers)
      .values({
        name: "Wiring",
        surname: "WithPermission",
        email: `staff-routes-wiring-with-${stamp}@test.local`,
        password: "unused-in-this-test",
        roleId: testRoleId,
      })
      .$returningId();
    withPermissionId = withPermission.id;
    withPermissionToken = jwt.sign({ userId: withPermissionId }, env.SECRET_KEY, { expiresIn: "15m" });

    const [withoutPermission] = await db
      .insert(staffUsers)
      .values({
        name: "Wiring",
        surname: "WithoutPermission",
        email: `staff-routes-wiring-without-${stamp}@test.local`,
        password: "unused-in-this-test",
        roleId: 2,
      })
      .$returningId();
    withoutPermissionId = withoutPermission.id;
    withoutPermissionToken = jwt.sign({ userId: withoutPermissionId }, env.SECRET_KEY, { expiresIn: "15m" });
  });

  afterAll(async () => {
    await db.delete(staffUsers).where(eq(staffUsers.id, withPermissionId));
    await db.delete(staffUsers).where(eq(staffUsers.id, withoutPermissionId));
    await db.delete(roles).where(eq(roles.id, testRoleId));
  });

  afterEach(() => {
    vi.mocked(StaffService.list).mockReset();
    vi.mocked(StaffService.getById).mockReset();
    vi.mocked(StaffService.create).mockReset();
    vi.mocked(StaffService.reassignRole).mockReset();
    vi.mocked(StaffService.remove).mockReset();
  });

  it("recusa qualquer rota sem autenticação (401)", async () => {
    const response = await request(buildApp()).get("/api/staff");
    expect(response.status).toBe(401);
  });

  it("recusa GET e POST para um staff sem staff.manage (403) — prova que o gate do mount está de fato aplicado", async () => {
    const app = buildApp();

    const getResponse = await request(app).get("/api/staff").set("Authorization", `Bearer ${withoutPermissionToken}`);
    expect(getResponse.status).toBe(403);
    expect(StaffService.list).not.toHaveBeenCalled();

    const postResponse = await request(app)
      .post("/api/staff")
      .set("Authorization", `Bearer ${withoutPermissionToken}`)
      .send({ name: "X", surname: "Y", email: "x@test.local", password: "senha-forte-123", roleId: 2 });
    expect(postResponse.status).toBe(403);
    expect(StaffService.create).not.toHaveBeenCalled();
  });

  it("GET /api/staff: com staff.manage, repassa page/limit para StaffService.list", async () => {
    vi.mocked(StaffService.list).mockResolvedValue({ data: [], pagination: { page: 2, limit: 10, total: 0, totalPages: 1 } });

    const response = await request(buildApp())
      .get("/api/staff?page=2&limit=10")
      .set("Authorization", `Bearer ${withPermissionToken}`);

    expect(response.status).toBe(200);
    expect(StaffService.list).toHaveBeenCalledWith({ page: 2, limit: 10 });
  });

  it("GET /api/staff/:id: um id não numérico devolve 400 antes de chamar o service (DTO amarrado)", async () => {
    const response = await request(buildApp()).get("/api/staff/abc").set("Authorization", `Bearer ${withPermissionToken}`);

    expect(response.status).toBe(400);
    expect(StaffService.getById).not.toHaveBeenCalled();
  });

  it("POST /api/staff: senha curta demais devolve 400 antes de chamar o service", async () => {
    const response = await request(buildApp())
      .post("/api/staff")
      .set("Authorization", `Bearer ${withPermissionToken}`)
      .send({ name: "X", surname: "Y", email: "x@test.local", password: "123", roleId: 2 });

    expect(response.status).toBe(400);
    expect(StaffService.create).not.toHaveBeenCalled();
  });

  it("POST /api/staff: corpo válido chama StaffService.create com o body e as permissões do ator autenticado", async () => {
    vi.mocked(StaffService.create).mockResolvedValue({ id: 999 } as never);
    const body = { name: "X", surname: "Y", email: "x@test.local", password: "senha-forte-123", roleId: 2 };

    const response = await request(buildApp()).post("/api/staff").set("Authorization", `Bearer ${withPermissionToken}`).send(body);

    expect(response.status).toBe(201);
    expect(StaffService.create).toHaveBeenCalledWith(body, ["staff.manage"], { id: expect.any(Number), email: expect.any(String) });
  });

  it("PATCH /api/staff/:id/role: chama StaffService.reassignRole com id do param, roleId do body e as permissões do ator", async () => {
    vi.mocked(StaffService.reassignRole).mockResolvedValue({ id: withoutPermissionId } as never);

    const response = await request(buildApp())
      .patch(`/api/staff/${withoutPermissionId}/role`)
      .set("Authorization", `Bearer ${withPermissionToken}`)
      .send({ roleId: 2 });

    expect(response.status).toBe(200);
    expect(StaffService.reassignRole).toHaveBeenCalledWith(withoutPermissionId, 2, ["staff.manage"], { id: expect.any(Number), email: expect.any(String) });
  });

  it("DELETE /api/staff/:id: chama StaffService.remove com o id do param e o id do ator autenticado", async () => {
    vi.mocked(StaffService.remove).mockResolvedValue({ status: true, message: "ok" });

    const response = await request(buildApp())
      .delete(`/api/staff/${withoutPermissionId}`)
      .set("Authorization", `Bearer ${withPermissionToken}`);

    expect(response.status).toBe(200);
    expect(StaffService.remove).toHaveBeenCalledWith(withoutPermissionId, withPermissionId, { id: expect.any(Number), email: expect.any(String) });
  });
});
