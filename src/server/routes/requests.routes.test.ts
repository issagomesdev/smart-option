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

vi.mock("../../services/requests.service", () => ({
  RequestService: {
    extract: vi.fn(),
    withdrawalRequests: vi.fn(),
    resWithdrawal: vi.fn(),
    wasRead: vi.fn(),
    pendingRequests: vi.fn(),
  },
}));

import { RequestService } from "../../services/requests.service";
import requestsRoute from "./requests.routes";

/**
 * Prova a fiação HTTP real de `/api/requests`, não a lógica de negócio (já
 * coberta pelos testes de `RequestService`) — o service é mockado. Foco nas
 * 2 únicas rotas de escrita deste router misto: `res-withdrawal`
 * (`withdrawals.approve` — a ação mais sensível do sistema, dispara PIX
 * real) e `was-read` (`support.write`). O resto (extrato, listagens) é
 * leitura aberta de propósito.
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
  app.use("/api/requests", authorize(), requestsRoute);
  app.use(errorHandler);
  return app;
}

describe("/api/requests (wiring HTTP — banco real para autenticação, RequestService mockado)", () => {
  let readOnlyId: number;
  let withdrawalsApproveOnlyId: number;
  let supportWriteOnlyId: number;
  let readOnlyToken: string;
  let withdrawalsApproveOnlyToken: string;
  let supportWriteOnlyToken: string;
  const testRoleIds: number[] = [];

  beforeAll(async () => {
    const stamp = Date.now();

    const [withdrawalsRole] = await db
      .insert(roles)
      .values({ name: `Requests Routes Wiring withdrawals.approve ${stamp}`, permissions: ["withdrawals.approve"] })
      .$returningId();
    testRoleIds.push(withdrawalsRole.id);

    const [supportRole] = await db
      .insert(roles)
      .values({ name: `Requests Routes Wiring support.write ${stamp}`, permissions: ["support.write"] })
      .$returningId();
    testRoleIds.push(supportRole.id);

    const [readOnly] = await db
      .insert(staffUsers)
      .values({ name: "Wiring", surname: "ReadOnly", email: `requests-routes-wiring-read-${stamp}@test.local`, password: "unused", roleId: 2 })
      .$returningId();
    readOnlyId = readOnly.id;
    readOnlyToken = jwt.sign({ userId: readOnlyId }, env.SECRET_KEY, { expiresIn: "15m" });

    const [withdrawalsApproveOnly] = await db
      .insert(staffUsers)
      .values({
        name: "Wiring",
        surname: "WithdrawalsApprove",
        email: `requests-routes-wiring-withdrawals-${stamp}@test.local`,
        password: "unused",
        roleId: withdrawalsRole.id,
      })
      .$returningId();
    withdrawalsApproveOnlyId = withdrawalsApproveOnly.id;
    withdrawalsApproveOnlyToken = jwt.sign({ userId: withdrawalsApproveOnlyId }, env.SECRET_KEY, { expiresIn: "15m" });

    const [supportWriteOnly] = await db
      .insert(staffUsers)
      .values({
        name: "Wiring",
        surname: "SupportWrite",
        email: `requests-routes-wiring-support-${stamp}@test.local`,
        password: "unused",
        roleId: supportRole.id,
      })
      .$returningId();
    supportWriteOnlyId = supportWriteOnly.id;
    supportWriteOnlyToken = jwt.sign({ userId: supportWriteOnlyId }, env.SECRET_KEY, { expiresIn: "15m" });
  });

  afterAll(async () => {
    await db.delete(staffUsers).where(eq(staffUsers.id, readOnlyId));
    await db.delete(staffUsers).where(eq(staffUsers.id, withdrawalsApproveOnlyId));
    await db.delete(staffUsers).where(eq(staffUsers.id, supportWriteOnlyId));
    for (const roleId of testRoleIds) {
      await db.delete(roles).where(eq(roles.id, roleId));
    }
  });

  afterEach(() => {
    vi.mocked(RequestService.extract).mockReset();
    vi.mocked(RequestService.resWithdrawal).mockReset();
    vi.mocked(RequestService.wasRead).mockReset();
  });

  describe("leitura aberta — qualquer staff autenticado", () => {
    it("GET /extract/:id funciona para um staff sem nenhuma permissão de escrita", async () => {
      vi.mocked(RequestService.extract).mockResolvedValue([] as never);
      const response = await request(buildApp()).get("/api/requests/extract/all").set("Authorization", `Bearer ${readOnlyToken}`);
      expect(response.status).toBe(200);
    });
  });

  describe("POST /res-withdrawal — exige withdrawals.approve, a permissão mais sensível do sistema", () => {
    it("403 sem a permissão, sem chamar o service", async () => {
      const response = await request(buildApp())
        .post("/api/requests/res-withdrawal")
        .set("Authorization", `Bearer ${readOnlyToken}`)
        .send({ res: true, id: 1 });
      expect(response.status).toBe(403);
      expect(RequestService.resWithdrawal).not.toHaveBeenCalled();
    });

    it("403 mesmo com support.write (permissão errada) — prova que é especificamente withdrawals.approve", async () => {
      const response = await request(buildApp())
        .post("/api/requests/res-withdrawal")
        .set("Authorization", `Bearer ${supportWriteOnlyToken}`)
        .send({ res: true, id: 1 });
      expect(response.status).toBe(403);
    });

    it("com withdrawals.approve, chama RequestService.resWithdrawal com o corpo e o ator autenticado", async () => {
      vi.mocked(RequestService.resWithdrawal).mockResolvedValue({ status: true, message: "ok" });
      const body = { res: true, id: 1, observation: "aprovado" };

      const response = await request(buildApp())
        .post("/api/requests/res-withdrawal")
        .set("Authorization", `Bearer ${withdrawalsApproveOnlyToken}`)
        .send(body);

      expect(response.status).toBe(200);
      expect(RequestService.resWithdrawal).toHaveBeenCalledWith(body, expect.objectContaining({ id: withdrawalsApproveOnlyId }));
    });

    it("recusa corpo inválido (sem id) com 400 antes de chamar o service", async () => {
      const response = await request(buildApp())
        .post("/api/requests/res-withdrawal")
        .set("Authorization", `Bearer ${withdrawalsApproveOnlyToken}`)
        .send({ res: true });
      expect(response.status).toBe(400);
      expect(RequestService.resWithdrawal).not.toHaveBeenCalled();
    });
  });

  describe("PATCH /was-read/:id/:status — exige support.write", () => {
    it("403 sem a permissão, sem chamar o service", async () => {
      const response = await request(buildApp()).patch("/api/requests/was-read/1/1").set("Authorization", `Bearer ${readOnlyToken}`);
      expect(response.status).toBe(403);
      expect(RequestService.wasRead).not.toHaveBeenCalled();
    });

    it("403 mesmo com withdrawals.approve (permissão errada) — prova que é especificamente support.write", async () => {
      const response = await request(buildApp())
        .patch("/api/requests/was-read/1/1")
        .set("Authorization", `Bearer ${withdrawalsApproveOnlyToken}`);
      expect(response.status).toBe(403);
    });

    it("com support.write, chama RequestService.wasRead com id e status do param", async () => {
      vi.mocked(RequestService.wasRead).mockResolvedValue({ status: true, message: "ok" });

      const response = await request(buildApp()).patch("/api/requests/was-read/7/1").set("Authorization", `Bearer ${supportWriteOnlyToken}`);

      expect(response.status).toBe(200);
      // `validate({ params: wasReadParamsDto })` já coage para número antes
      // de chegar no handler (`z.coerce.number()`) — `req.params` deixa de
      // ser string depois do middleware, mesmo vindo de uma URL.
      expect(RequestService.wasRead).toHaveBeenCalledWith(7, 1);
    });
  });
});
