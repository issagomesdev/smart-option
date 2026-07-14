import { afterAll, afterEach, describe, expect, it } from "vitest";
import { redis } from "../infrastructure/cache/redis";
import { sessionService } from "./session.service";

const TEST_USER_IDS = [900001, 900002, 900003];

async function cleanup(): Promise<void> {
  for (const userId of TEST_USER_IDS) {
    await sessionService.clear(userId);
  }
}

describe("SessionService (Redis real)", () => {
  afterEach(cleanup);
  afterAll(async () => {
    await cleanup();
    redis.disconnect();
  });

  it("retorna uma sessão vazia para um usuário sem estado salvo", async () => {
    const session = await sessionService.get(TEST_USER_IDS[0]);
    expect(session).toEqual({ flow: null, step: null, data: {} });
  });

  it("persiste e recupera a sessão do usuário (roundtrip)", async () => {
    const userId = TEST_USER_IDS[0];
    await sessionService.enterFlow(userId, "deposit", "value", { foo: "bar" });

    const session = await sessionService.get(userId);
    expect(session).toEqual({ flow: "deposit", step: "value", data: { foo: "bar" } });
  });

  it("setStep atualiza somente o step, preservando flow e data", async () => {
    const userId = TEST_USER_IDS[0];
    await sessionService.enterFlow(userId, "withdrawal", "value", { value: "100,00" });

    await sessionService.setStep(userId, "confirm");

    const session = await sessionService.get(userId);
    expect(session).toEqual({ flow: "withdrawal", step: "confirm", data: { value: "100,00" } });
  });

  it("patchData faz merge raso com os dados já existentes", async () => {
    const userId = TEST_USER_IDS[0];
    await sessionService.enterFlow(userId, "register", "collecting", { name: "Fulano" });

    await sessionService.patchData(userId, { email: "fulano@example.com" });

    const session = await sessionService.get(userId);
    expect(session.data).toEqual({ name: "Fulano", email: "fulano@example.com" });
  });

  it("clear remove a sessão por completo", async () => {
    const userId = TEST_USER_IDS[0];
    await sessionService.enterFlow(userId, "login", "email", {});

    await sessionService.clear(userId);

    const session = await sessionService.get(userId);
    expect(session).toEqual({ flow: null, step: null, data: {} });
  });

  it("aplica um TTL de expiração à chave de sessão", async () => {
    const userId = TEST_USER_IDS[0];
    await sessionService.enterFlow(userId, "deposit", "value", {});

    const ttl = await redis.ttl(`bot:session:${userId}`);
    expect(ttl).toBeGreaterThan(0);
    expect(ttl).toBeLessThanOrEqual(30 * 60);
  });

  it("isola o estado entre múltiplos usuários concorrentes — a garantia central desta fase", async () => {
    const [userA, userB, userC] = TEST_USER_IDS;

    // Simula três conversas de cadastro entreveradas: cada usuário avança um
    // passo por vez, na ordem A, B, C, A, B, C — exatamente o padrão que
    // corrompia dados quando o estado vivia em variáveis `let` de módulo.
    await sessionService.enterFlow(userA, "register", "collecting", { name: "Usuário A" });
    await sessionService.enterFlow(userB, "register", "collecting", { name: "Usuário B" });
    await sessionService.enterFlow(userC, "login", "email", { email: "c@example.com" });

    await sessionService.patchData(userA, { email: "a@example.com" });
    await sessionService.patchData(userB, { email: "b@example.com" });
    await sessionService.setStep(userC, "password");

    await sessionService.patchData(userA, { cpf: "52998224725" });
    await sessionService.patchData(userB, { cpf: "11144477735" });

    const [sessionA, sessionB, sessionC] = await Promise.all([
      sessionService.get(userA),
      sessionService.get(userB),
      sessionService.get(userC),
    ]);

    expect(sessionA).toEqual({
      flow: "register",
      step: "collecting",
      data: { name: "Usuário A", email: "a@example.com", cpf: "52998224725" },
    });
    expect(sessionB).toEqual({
      flow: "register",
      step: "collecting",
      data: { name: "Usuário B", email: "b@example.com", cpf: "11144477735" },
    });
    expect(sessionC).toEqual({
      flow: "login",
      step: "password",
      data: { email: "c@example.com" },
    });
  });

  it("concluir o fluxo de um usuário (clear) não afeta a sessão de outro usuário em andamento", async () => {
    const [userA, userB] = TEST_USER_IDS;

    await sessionService.enterFlow(userA, "deposit", "confirm", { value: "50,00" });
    await sessionService.enterFlow(userB, "withdrawal", "confirm", { value: "75,00" });

    await sessionService.clear(userA);

    const [sessionA, sessionB] = await Promise.all([sessionService.get(userA), sessionService.get(userB)]);

    expect(sessionA).toEqual({ flow: null, step: null, data: {} });
    expect(sessionB).toEqual({ flow: "withdrawal", step: "confirm", data: { value: "75,00" } });
  });
});
