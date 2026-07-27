import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * O teste mais importante desta feature: provar que o reset é INERTE fora do modo demonstração.
 *
 * `runDemoReset` trunca 15 tabelas. Se a trava falhar, uma instalação de produção com esta versão
 * do código perde todos os dados transacionais. Por isso o caminho recusado é verificado aqui pelo
 * efeito (nenhuma query executada), e não só pela exceção — lançar depois de já ter truncado algo
 * também passaria num teste que só olhasse o `throw`.
 *
 * Os dois módulos abaixo são mockados porque este arquivo NÃO deve tocar o banco: um teste de
 * "não apaga nada" que rodasse contra o banco real seria, ele próprio, o risco que quer evitar.
 */
const execute = vi.fn();
const seedPlans = vi.fn();
const seedDemoData = vi.fn();
const redisKeys = vi.fn();
const redisDel = vi.fn();

vi.mock("../client", () => ({ db: { execute: (...args: unknown[]) => execute(...args) } }));
vi.mock("../../cache/redis", () => ({
  redis: { keys: (...args: unknown[]) => redisKeys(...args), del: (...args: unknown[]) => redisDel(...args) },
}));
vi.mock("./plans.seed", () => ({ seedPlans: () => seedPlans() }));
vi.mock("./demo.seed", () => ({ seedDemoData: () => seedDemoData() }));

async function loadResetModule(appDemo: boolean) {
  vi.resetModules();
  const actual = await vi.importActual<typeof import("../../../config/env")>("../../../config/env");
  vi.doMock("../../../config/env", () => ({ ...actual, env: { ...actual.env, APP_DEMO: appDemo } }));
  return import("./demo-reset.logic");
}

afterEach(() => {
  vi.doUnmock("../../../config/env");
  vi.resetModules();
  execute.mockReset();
  seedPlans.mockReset();
  seedDemoData.mockReset();
  redisKeys.mockReset();
  redisDel.mockReset();
});

describe("runDemoReset", () => {
  it("com APP_DEMO=false: recusa E não executa NENHUMA query nem seed", async () => {
    const { runDemoReset } = await loadResetModule(false);

    await expect(runDemoReset()).rejects.toThrow(/APP_DEMO=true/);

    // A parte que realmente importa: nada foi tocado.
    expect(execute).not.toHaveBeenCalled();
    expect(seedPlans).not.toHaveBeenCalled();
    expect(seedDemoData).not.toHaveBeenCalled();
    expect(redisDel).not.toHaveBeenCalled();
  });

  it("com APP_DEMO=true: trunca, re-semeia planos e dados, e limpa o cache do dashboard", async () => {
    execute.mockResolvedValue(undefined);
    seedPlans.mockResolvedValue(6);
    seedDemoData.mockResolvedValue({
      users: 300,
      ledgerEntries: 11_000,
      checkouts: 800,
      withdrawals: 100,
      supportRequests: 40,
    });
    redisKeys.mockResolvedValue(["dashboard:summary:today::::"]);
    redisDel.mockResolvedValue(1);

    const { runDemoReset } = await loadResetModule(true);
    const summary = await runDemoReset();

    expect(summary).toMatchObject({ users: 300, plans: 6, clearedTables: 15 });
    expect(seedPlans).toHaveBeenCalledOnce();
    expect(seedDemoData).toHaveBeenCalledOnce();
    expect(redisDel).toHaveBeenCalled();
  });

  it("nunca trunca staff_users nem roles — um reset não pode tirar o acesso de quem administra", async () => {
    execute.mockResolvedValue(undefined);
    seedPlans.mockResolvedValue(6);
    seedDemoData.mockResolvedValue({ users: 0, ledgerEntries: 0, checkouts: 0, withdrawals: 0, supportRequests: 0 });
    redisKeys.mockResolvedValue([]);

    const { runDemoReset } = await loadResetModule(true);
    await runDemoReset();

    const executedSql = execute.mock.calls.map(([query]) => JSON.stringify(query)).join(" ");
    expect(executedSql).not.toMatch(/staff_users/);
    expect(executedSql).not.toMatch(/`users`/);
    expect(executedSql).not.toMatch(/roles/);
    // `products` também sobrevive: é catálogo, reconvergido por upsert (preserva os IDs fixos que
    // `cron.ts` referencia em vez de reiniciar o AUTO_INCREMENT).
    expect(executedSql).not.toMatch(/TRUNCATE TABLE `products`/);
  });

  it("restaura FOREIGN_KEY_CHECKS mesmo se um TRUNCATE falhar no meio", async () => {
    seedPlans.mockResolvedValue(6);
    redisKeys.mockResolvedValue([]);
    let call = 0;
    execute.mockImplementation(() => {
      call += 1;
      // 1ª chamada desliga as FKs; a 2ª (primeiro TRUNCATE) explode.
      if (call === 2) return Promise.reject(new Error("truncate falhou"));
      return Promise.resolve(undefined);
    });

    const { runDemoReset } = await loadResetModule(true);
    await expect(runDemoReset()).rejects.toThrow(/truncate falhou/);

    // Deixar as FKs desligadas corromperia silenciosamente toda escrita seguinte do processo.
    const executedSql = execute.mock.calls.map(([query]) => JSON.stringify(query)).join(" ");
    expect(executedSql).toMatch(/FOREIGN_KEY_CHECKS = 1/);
  });
});
