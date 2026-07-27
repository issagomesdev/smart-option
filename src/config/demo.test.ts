import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * `demo.ts` lê `env` uma vez, no import (é uma constante de processo, não uma leitura por chamada).
 * Para exercitar os dois modos é preciso reimportar o módulo com o `env` trocado — daí o
 * `resetModules` + `doMock` em vez de simplesmente mexer em `process.env`.
 *
 * `shared/errors` é reimportado junto, da mesma geração do registro de módulos: depois de
 * `resetModules`, a classe `ForbiddenError` do módulo recarregado é um objeto diferente da que um
 * `import` estático no topo deste arquivo teria capturado, e `instanceof` falharia por identidade
 * mesmo com o erro correto (artefato do teste, não do código).
 */
async function loadDemoModule(overrides: { APP_DEMO?: boolean; AUTO_RESET?: boolean; AUTO_RESET_INTERVAL?: number }) {
  vi.resetModules();
  const actual = await vi.importActual<typeof import("./env")>("./env");
  vi.doMock("./env", () => ({
    ...actual,
    env: { ...actual.env, APP_DEMO: false, AUTO_RESET: false, AUTO_RESET_INTERVAL: undefined, ...overrides },
  }));
  const [demo, errors] = await Promise.all([import("./demo"), import("../shared/errors")]);
  return { ...demo, ForbiddenError: errors.ForbiddenError };
}

afterEach(() => {
  vi.doUnmock("./env");
  vi.resetModules();
});

describe("guards do modo demonstração", () => {
  describe("assertDemoEnabled (trava do reset destrutivo)", () => {
    // A garantia central de toda a feature: sem APP_DEMO, o reset não roda. Se este teste quebrar,
    // uma instalação de produção passa a poder perder dados.
    it("lança com APP_DEMO=false, citando a operação recusada", async () => {
      const demo = await loadDemoModule({ APP_DEMO: false });
      expect(() => demo.assertDemoEnabled("demo:reset")).toThrow(/demo:reset/);
      expect(() => demo.assertDemoEnabled("demo:reset")).toThrow(/APP_DEMO=true/);
    });

    it("passa com APP_DEMO=true", async () => {
      const demo = await loadDemoModule({ APP_DEMO: true });
      expect(() => demo.assertDemoEnabled("demo:reset")).not.toThrow();
    });
  });

  describe("assertNotDemo (bloqueio das ações irreversíveis)", () => {
    it("lança ForbiddenError com a mensagem do produto quando em demonstração", async () => {
      const demo = await loadDemoModule({ APP_DEMO: true });
      expect(() => demo.assertNotDemo()).toThrow(demo.ForbiddenError);
      expect(() => demo.assertNotDemo()).toThrow("Esta ação está desabilitada na demonstração.");
    });

    it("não interfere fora do modo demonstração", async () => {
      const demo = await loadDemoModule({ APP_DEMO: false });
      expect(() => demo.assertNotDemo()).not.toThrow();
    });
  });

  describe("resolveAutoResetIntervalMs", () => {
    it("converte minutos em milissegundos quando tudo está ligado", async () => {
      const demo = await loadDemoModule({ APP_DEMO: true, AUTO_RESET: true, AUTO_RESET_INTERVAL: 60 });
      expect(demo.resolveAutoResetIntervalMs()).toBe(3_600_000);
    });

    it.each([
      ["APP_DEMO desligado", { APP_DEMO: false, AUTO_RESET: true, AUTO_RESET_INTERVAL: 60 }],
      ["AUTO_RESET desligado", { APP_DEMO: true, AUTO_RESET: false, AUTO_RESET_INTERVAL: 60 }],
      ["sem intervalo", { APP_DEMO: true, AUTO_RESET: true }],
    ])("devolve null com %s", async (_label, overrides) => {
      const demo = await loadDemoModule(overrides);
      expect(demo.resolveAutoResetIntervalMs()).toBeNull();
    });
  });
});
