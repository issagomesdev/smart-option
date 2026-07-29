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

vi.mock("../../services/users.service", () => ({
  UsersService: {
    updateUser: vi.fn(),
    updatePass: vi.fn(),
    botUsers: vi.fn(),
    botUser: vi.fn(),
    updateBotUser: vi.fn(),
    deleteBotUser: vi.fn(),
    isActiveBotUser: vi.fn(),
    transfValuesAdmin: vi.fn(),
  },
}));
vi.mock("../../services/bot/register.service", () => ({
  RegisterService: { registerUser: vi.fn() },
}));

import { UsersService } from "../../services/users.service";
import { RegisterService } from "../../services/bot/register.service";
import usersRoute from "./users.routes";

/**
 * Prova a fiação HTTP real de `/api/users`, não a lógica de negócio (já
 * coberta pelos testes de `UsersService`) — os services são mockados.
 * `users.routes.ts` mistura rotas de leitura aberta, self-service (id vem
 * sempre do token, nunca do corpo — corrigido na Fase 5 parte 1) e escrita
 * gateada rota a rota (`users.write`/`finance.adjust`) — o objetivo aqui é
 * provar que cada rota tem exatamente o gate certo, nem mais nem menos.
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
  app.use("/api/users", authorize(), usersRoute);
  app.use(errorHandler);
  return app;
}

describe("/api/users (wiring HTTP — banco real para autenticação, services mockados)", () => {
  let readOnlyId: number;
  let usersWriteOnlyId: number;
  let fullWriteId: number;
  let readOnlyToken: string;
  let usersWriteOnlyToken: string;
  let fullWriteToken: string;
  const testRoleIds: number[] = [];

  beforeAll(async () => {
    const stamp = Date.now();

    const [usersWriteRole] = await db
      .insert(roles)
      .values({ name: `Users Routes Wiring users.write ${stamp}`, permissions: ["users.write"] })
      .$returningId();
    testRoleIds.push(usersWriteRole.id);

    const [fullWriteRole] = await db
      .insert(roles)
      .values({ name: `Users Routes Wiring full ${stamp}`, permissions: ["users.write", "finance.adjust"] })
      .$returningId();
    testRoleIds.push(fullWriteRole.id);

    const [readOnly] = await db
      .insert(staffUsers)
      .values({ name: "Wiring", surname: "ReadOnly", email: `users-routes-wiring-read-${stamp}@test.local`, password: "unused", roleId: 2 })
      .$returningId();
    readOnlyId = readOnly.id;
    readOnlyToken = jwt.sign({ userId: readOnlyId }, env.SECRET_KEY, { expiresIn: "15m" });

    const [usersWriteOnly] = await db
      .insert(staffUsers)
      .values({
        name: "Wiring",
        surname: "UsersWriteOnly",
        email: `users-routes-wiring-write-${stamp}@test.local`,
        password: "unused",
        roleId: usersWriteRole.id,
      })
      .$returningId();
    usersWriteOnlyId = usersWriteOnly.id;
    usersWriteOnlyToken = jwt.sign({ userId: usersWriteOnlyId }, env.SECRET_KEY, { expiresIn: "15m" });

    const [fullWrite] = await db
      .insert(staffUsers)
      .values({
        name: "Wiring",
        surname: "FullWrite",
        email: `users-routes-wiring-full-${stamp}@test.local`,
        password: "unused",
        roleId: fullWriteRole.id,
      })
      .$returningId();
    fullWriteId = fullWrite.id;
    fullWriteToken = jwt.sign({ userId: fullWriteId }, env.SECRET_KEY, { expiresIn: "15m" });
  });

  afterAll(async () => {
    await db.delete(staffUsers).where(eq(staffUsers.id, readOnlyId));
    await db.delete(staffUsers).where(eq(staffUsers.id, usersWriteOnlyId));
    await db.delete(staffUsers).where(eq(staffUsers.id, fullWriteId));
    for (const roleId of testRoleIds) {
      await db.delete(roles).where(eq(roles.id, roleId));
    }
  });

  afterEach(() => {
    vi.mocked(UsersService.updateUser).mockReset();
    vi.mocked(UsersService.updatePass).mockReset();
    vi.mocked(UsersService.botUsers).mockReset();
    vi.mocked(UsersService.updateBotUser).mockReset();
    vi.mocked(UsersService.deleteBotUser).mockReset();
    vi.mocked(UsersService.isActiveBotUser).mockReset();
    vi.mocked(UsersService.transfValuesAdmin).mockReset();
    vi.mocked(RegisterService.registerUser).mockReset();
  });

  describe("leitura aberta — qualquer staff autenticado, sem permissão nenhuma", () => {
    it("GET /users-bot/:search funciona para um staff sem nenhuma permissão de escrita", async () => {
      vi.mocked(UsersService.botUsers).mockResolvedValue([] as never);
      const response = await request(buildApp()).get("/api/users/users-bot/all").set("Authorization", `Bearer ${readOnlyToken}`);
      expect(response.status).toBe(200);
    });

    it("POST /users-bot (listagem paginada) funciona para um staff sem nenhuma permissão de escrita", async () => {
      vi.mocked(UsersService.botUsers).mockResolvedValue({ data: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 1 } } as never);
      const response = await request(buildApp()).post("/api/users/users-bot").set("Authorization", `Bearer ${readOnlyToken}`).send({});
      expect(response.status).toBe(200);
    });
  });

  describe("self-service — PATCH /update-user e /update-pass ignoram qualquer id no corpo", () => {
    it("PATCH /update-user aplica em req.user.id, mesmo se o corpo tentar mandar um id diferente", async () => {
      vi.mocked(UsersService.updateUser).mockResolvedValue({ status: true });

      const response = await request(buildApp())
        .patch("/api/users/update-user")
        .set("Authorization", `Bearer ${readOnlyToken}`)
        .send({ id: 999999999, name: "Novo Nome", surname: "Sobrenome", email: "novo@test.local" });

      expect(response.status).toBe(200);
      expect(UsersService.updateUser).toHaveBeenCalledWith(readOnlyId, { name: "Novo Nome", surname: "Sobrenome", email: "novo@test.local" });
    });

    it("PATCH /update-pass também não exige nenhuma permissão de escrita", async () => {
      vi.mocked(UsersService.updatePass).mockResolvedValue({ status: true });

      const response = await request(buildApp())
        .patch("/api/users/update-pass")
        .set("Authorization", `Bearer ${readOnlyToken}`)
        .send({ currentPassword: "atual123", newPassword: "nova-senha-123" });

      expect(response.status).toBe(200);
      expect(UsersService.updatePass).toHaveBeenCalledWith(readOnlyId, { currentPassword: "atual123", newPassword: "nova-senha-123" });
    });
  });

  describe("escrita de bot user — exige users.write", () => {
    it("POST /user-bot: 403 sem users.write, sem chamar RegisterService", async () => {
      const response = await request(buildApp()).post("/api/users/user-bot").set("Authorization", `Bearer ${readOnlyToken}`).send({});
      expect(response.status).toBe(403);
      expect(RegisterService.registerUser).not.toHaveBeenCalled();
    });

    it("POST /user-bot: com users.write, chama RegisterService.registerUser com o corpo", async () => {
      vi.mocked(RegisterService.registerUser).mockResolvedValue({ id: 1 } as never);
      const body = { name: "X", email: "x@test.local" };

      const response = await request(buildApp()).post("/api/users/user-bot").set("Authorization", `Bearer ${usersWriteOnlyToken}`).send(body);

      expect(response.status).toBe(200);
      expect(RegisterService.registerUser).toHaveBeenCalledWith(body, null, { id: expect.any(Number), email: expect.any(String) });
    });

    it("PATCH /user-bot: 403 sem users.write", async () => {
      const response = await request(buildApp())
        .patch("/api/users/user-bot")
        .set("Authorization", `Bearer ${readOnlyToken}`)
        .send({ id: 1, name: "X", email: "x@test.local", phone_number: "1", adress: "1", pix_code: "1" });
      expect(response.status).toBe(403);
      expect(UsersService.updateBotUser).not.toHaveBeenCalled();
    });

    it("DELETE /user-bot/:id: 403 sem users.write; com ela, chama UsersService.deleteBotUser", async () => {
      const forbidden = await request(buildApp()).delete("/api/users/user-bot/42").set("Authorization", `Bearer ${readOnlyToken}`);
      expect(forbidden.status).toBe(403);

      vi.mocked(UsersService.deleteBotUser).mockResolvedValue({ status: true, message: "ok" });
      const allowed = await request(buildApp()).delete("/api/users/user-bot/42").set("Authorization", `Bearer ${usersWriteOnlyToken}`);
      expect(allowed.status).toBe(200);
      expect(UsersService.deleteBotUser).toHaveBeenCalledWith(42, { id: expect.any(Number), email: expect.any(String) });
    });

    it("PUT /user-bot/:id/:status: 403 sem users.write; com ela, chama UsersService.isActiveBotUser", async () => {
      const forbidden = await request(buildApp()).put("/api/users/user-bot/42/1").set("Authorization", `Bearer ${readOnlyToken}`);
      expect(forbidden.status).toBe(403);

      vi.mocked(UsersService.isActiveBotUser).mockResolvedValue({ status: true, message: "ok" });
      const allowed = await request(buildApp()).put("/api/users/user-bot/42/1").set("Authorization", `Bearer ${usersWriteOnlyToken}`);
      expect(allowed.status).toBe(200);
      expect(UsersService.isActiveBotUser).toHaveBeenCalledWith(42, 1, { id: expect.any(Number), email: expect.any(String) });
    });
  });

  describe("POST /transf-user-admin — exige especificamente finance.adjust, não users.write", () => {
    it("403 sem nenhuma permissão", async () => {
      const response = await request(buildApp())
        .post("/api/users/transf-user-admin")
        .set("Authorization", `Bearer ${readOnlyToken}`)
        .send({ user_id: 1, value: "10.00", type: "sum" });
      expect(response.status).toBe(403);
    });

    it("403 mesmo com users.write, se não tiver finance.adjust — prova que é a permissão certa, não 'qualquer uma'", async () => {
      const response = await request(buildApp())
        .post("/api/users/transf-user-admin")
        .set("Authorization", `Bearer ${usersWriteOnlyToken}`)
        .send({ user_id: 1, value: "10.00", type: "sum" });
      expect(response.status).toBe(403);
      expect(UsersService.transfValuesAdmin).not.toHaveBeenCalled();
    });

    it("com finance.adjust, chama UsersService.transfValuesAdmin com o corpo e o ator autenticado", async () => {
      vi.mocked(UsersService.transfValuesAdmin).mockResolvedValue({ status: true, message: "ok" });
      const body = { user_id: 1, value: "10.00", type: "sum" as const };

      const response = await request(buildApp())
        .post("/api/users/transf-user-admin")
        .set("Authorization", `Bearer ${fullWriteToken}`)
        .send(body);

      expect(response.status).toBe(200);
      expect(UsersService.transfValuesAdmin).toHaveBeenCalledWith(body, expect.objectContaining({ id: fullWriteId }));
    });
  });
});
