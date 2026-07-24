import express from "express";
import jwt from "jsonwebtoken";
import request from "supertest";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "../../infrastructure/database/client";
import { roles, staffUsers } from "../../infrastructure/database/schema";
import { env } from "../../config/env";
import { errorHandler } from "../../infrastructure/http/middlewares/error-handler";
import { authorize, requireAnyPermission, requirePermission } from "./auth.interceptor";

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

  it("req.user.permissions reflete o papel do staff (role_id=1, 'admin', tem as 6 permissões)", async () => {
    const [adminStaff] = await db
      .insert(staffUsers)
      .values({
        name: "Admin Role",
        surname: "Test",
        email: `auth-interceptor-admin-${Date.now()}@test.local`,
        password: "unused-in-this-test",
        roleId: 1,
      })
      .$returningId();

    try {
      const token = jwt.sign({ userId: adminStaff.id }, env.SECRET_KEY, { expiresIn: "15m" });
      const response = await request(buildApp()).get("/protected").set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.user.permissions).toEqual([
        "users.write",
        "finance.adjust",
        "withdrawals.approve",
        "support.write",
        "staff.manage",
        "roles.manage",
      ]);
    } finally {
      await db.delete(staffUsers).where(eq(staffUsers.id, adminStaff.id));
    }
  });

  it("staff sem papel atribuído explicitamente (default role_id=2, 'staff') tem permissions vazio", async () => {
    const token = jwt.sign({ userId }, env.SECRET_KEY, { expiresIn: "15m" });
    const response = await request(buildApp()).get("/protected").set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.user.permissions).toEqual([]);
  });

  it("staff desativado (deletedAt setado) recebe 401 mesmo com um token válido — efeito imediato, sem esperar o token expirar", async () => {
    const [deactivated] = await db
      .insert(staffUsers)
      .values({
        name: "Deactivated",
        surname: "Test",
        email: `auth-interceptor-deactivated-${Date.now()}@test.local`,
        password: "unused-in-this-test",
        deletedAt: new Date(),
      })
      .$returningId();

    try {
      const token = jwt.sign({ userId: deactivated.id }, env.SECRET_KEY, { expiresIn: "15m" });
      const response = await request(buildApp()).get("/protected").set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(401);
    } finally {
      await db.delete(staffUsers).where(eq(staffUsers.id, deactivated.id));
    }
  });
});

describe("requirePermission() middleware (integração, banco real)", () => {
  let adminId: number;
  let staffId: number;

  function buildAppWithPermission() {
    const app = express();
    app.use((req, _res, next) => {
      // @ts-expect-error simplificação do pino-http real, só o suficiente para o error handler funcionar no teste
      req.log = { error: () => {}, warn: () => {} };
      req.id = "test-request-id";
      next();
    });

    app.get("/staff-only", authorize(), requirePermission("staff.manage"), (_req, res) => {
      res.json({ ok: true });
    });

    app.use(errorHandler);
    return app;
  }

  beforeAll(async () => {
    const [admin] = await db
      .insert(staffUsers)
      .values({
        name: "RequirePermission Admin",
        surname: "Test",
        email: `require-permission-admin-${Date.now()}@test.local`,
        password: "unused-in-this-test",
        roleId: 1,
      })
      .$returningId();
    adminId = admin.id;

    const [staff] = await db
      .insert(staffUsers)
      .values({
        name: "RequirePermission Staff",
        surname: "Test",
        email: `require-permission-staff-${Date.now()}@test.local`,
        password: "unused-in-this-test",
        roleId: 2,
      })
      .$returningId();
    staffId = staff.id;
  });

  afterAll(async () => {
    await db.delete(staffUsers).where(eq(staffUsers.id, adminId));
    await db.delete(staffUsers).where(eq(staffUsers.id, staffId));
  });

  it("permite a requisição quando req.user.permissions inclui a permissão exigida", async () => {
    const token = jwt.sign({ userId: adminId }, env.SECRET_KEY, { expiresIn: "15m" });
    const response = await request(buildAppWithPermission()).get("/staff-only").set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
  });

  it("responde 403 (ForbiddenError) quando req.user.permissions não inclui a permissão exigida", async () => {
    const token = jwt.sign({ userId: staffId }, env.SECRET_KEY, { expiresIn: "15m" });
    const response = await request(buildAppWithPermission()).get("/staff-only").set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(403);
    expect(response.body.success).toBe(false);
  });

  it("responde 401 (não 403) quando nem autenticado", async () => {
    const response = await request(buildAppWithPermission()).get("/staff-only");
    expect(response.status).toBe(401);
  });
});

/**
 * Achado ao construir a Fase 5 parte 7 (telas de Equipe do painel): atribuir
 * um papel a um staff (`staff.manage`) exige poder ler a lista de papéis
 * disponíveis primeiro (`GET /api/roles`) — mas essa rota era gateada só por
 * `roles.manage`, uma permissão deliberadamente separada. `requireAnyPermission`
 * corrige esse buraco, aceitando qualquer uma das permissões listadas.
 */
describe("requireAnyPermission() middleware (integração, banco real)", () => {
  let onlyStaffManageId: number;
  let onlyRolesManageId: number;
  let neitherId: number;
  let staffManageOnlyRoleId: number;

  function buildAppWithAnyPermission() {
    const app = express();
    app.use((req, _res, next) => {
      // @ts-expect-error simplificação do pino-http real, só o suficiente para o error handler funcionar no teste
      req.log = { error: () => {}, warn: () => {} };
      req.id = "test-request-id";
      next();
    });

    app.get("/roles-or-staff", authorize(), requireAnyPermission("staff.manage", "roles.manage"), (_req, res) => {
      res.json({ ok: true });
    });

    app.use(errorHandler);
    return app;
  }

  beforeAll(async () => {
    const stamp = Date.now();
    const [role] = await db
      .insert(roles)
      .values({ name: `RequireAnyPermission Staff-Manage-Only ${stamp}`, permissions: ["staff.manage"] })
      .$returningId();
    staffManageOnlyRoleId = role.id;

    const [onlyStaffManage] = await db
      .insert(staffUsers)
      .values({
        name: "RequireAnyPermission",
        surname: "StaffManageOnly",
        email: `require-any-permission-staff-manage-${stamp}@test.local`,
        password: "unused-in-this-test",
        roleId: staffManageOnlyRoleId,
      })
      .$returningId();
    onlyStaffManageId = onlyStaffManage.id;

    const [onlyRolesManage] = await db
      .insert(staffUsers)
      .values({
        name: "RequireAnyPermission",
        surname: "RolesManageOnly",
        email: `require-any-permission-roles-manage-${stamp}@test.local`,
        password: "unused-in-this-test",
        roleId: 1, // admin — tem roles.manage (e as outras 5), suficiente para provar o caminho "OR"
      })
      .$returningId();
    onlyRolesManageId = onlyRolesManage.id;

    const [neither] = await db
      .insert(staffUsers)
      .values({
        name: "RequireAnyPermission",
        surname: "Neither",
        email: `require-any-permission-neither-${stamp}@test.local`,
        password: "unused-in-this-test",
        roleId: 2, // staff — sem nenhuma permissão
      })
      .$returningId();
    neitherId = neither.id;
  });

  afterAll(async () => {
    await db.delete(staffUsers).where(eq(staffUsers.id, onlyStaffManageId));
    await db.delete(staffUsers).where(eq(staffUsers.id, onlyRolesManageId));
    await db.delete(staffUsers).where(eq(staffUsers.id, neitherId));
    await db.delete(roles).where(eq(roles.id, staffManageOnlyRoleId));
  });

  it("permite quando o staff só tem a primeira permissão da lista (staff.manage)", async () => {
    const token = jwt.sign({ userId: onlyStaffManageId }, env.SECRET_KEY, { expiresIn: "15m" });
    const response = await request(buildAppWithAnyPermission()).get("/roles-or-staff").set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
  });

  it("permite quando o staff só tem a segunda permissão da lista (roles.manage)", async () => {
    const token = jwt.sign({ userId: onlyRolesManageId }, env.SECRET_KEY, { expiresIn: "15m" });
    const response = await request(buildAppWithAnyPermission()).get("/roles-or-staff").set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
  });

  it("responde 403 quando o staff não tem nenhuma das permissões listadas", async () => {
    const token = jwt.sign({ userId: neitherId }, env.SECRET_KEY, { expiresIn: "15m" });
    const response = await request(buildAppWithAnyPermission()).get("/roles-or-staff").set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(403);
    expect(response.body.success).toBe(false);
  });

  it("responde 401 (não 403) quando nem autenticado", async () => {
    const response = await request(buildAppWithAnyPermission()).get("/roles-or-staff");
    expect(response.status).toBe(401);
  });
});
