import express from "express";
import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * `denyInDemo` decide, por variável de ambiente, se uma ação irreversível pode acontecer. As duas
 * direções importam igualmente:
 *
 * - ligado, precisa BLOQUEAR (senão um visitante dispara PIX real na Asaas);
 * - desligado, precisa ser INERTE (senão uma instalação de produção fica com rotas quebradas).
 *
 * O segundo caso é o que um teste ingênuo esquece, e é o que quebraria produção.
 */
async function buildAppWithDemo(appDemo: boolean) {
  vi.resetModules();
  const actual = await vi.importActual<typeof import("../../config/env")>("../../config/env");
  vi.doMock("../../config/env", () => ({ ...actual, env: { ...actual.env, APP_DEMO: appDemo } }));

  // `errorHandler` é importado AQUI, depois do `resetModules`, e não no topo do arquivo: ele
  // reconhece erros por `instanceof AppError`, e após um reset o `ForbiddenError` que
  // `auth.interceptor` lança vem de uma instância nova do módulo `shared/errors`. Importado de
  // gerações diferentes, o `instanceof` falha por identidade e o handler devolveria 500 em vez de
  // 403 — artefato do teste, não do código (verificado no app real, que responde 403).
  const [{ denyInDemo }, { errorHandler }] = await Promise.all([
    import("./auth.interceptor"),
    import("../../infrastructure/http/middlewares/error-handler"),
  ]);

  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    // @ts-expect-error simplificação do pino-http real, suficiente para o error handler no teste
    req.log = { error: vi.fn(), warn: vi.fn() };
    req.id = "test-request-id";
    next();
  });
  app.post("/acao-sensivel", denyInDemo(), (_req, res) => {
    res.json({ success: true, data: { executed: true } });
  });
  app.use(errorHandler);
  return app;
}

afterEach(() => {
  vi.doUnmock("../../config/env");
  vi.resetModules();
});

describe("denyInDemo", () => {
  it("com APP_DEMO=true responde 403 com a mensagem exata mostrada ao usuário", async () => {
    const response = await request(await buildAppWithDemo(true)).post("/acao-sensivel").send({});

    expect(response.status).toBe(403);
    expect(response.body).toMatchObject({
      success: false,
      error: { code: "FORBIDDEN", message: "Esta ação está desabilitada na demonstração." },
    });
  });

  it("com APP_DEMO=true o handler nunca chega a executar", async () => {
    const response = await request(await buildAppWithDemo(true)).post("/acao-sensivel").send({});
    expect(response.body.data?.executed).toBeUndefined();
  });

  it("com APP_DEMO=false é totalmente transparente — produção não é afetada", async () => {
    const response = await request(await buildAppWithDemo(false)).post("/acao-sensivel").send({});

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual({ executed: true });
  });
});
