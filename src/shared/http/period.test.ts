import { describe, expect, it } from "vitest";
import { resolvePeriod } from "./period";

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

function startOfDay(date: Date): Date {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function endOfDay(date: Date): Date {
  const copy = new Date(date);
  copy.setHours(23, 59, 59, 999);
  return copy;
}

describe("resolvePeriod", () => {
  it("'today' cobre o dia inteiro de hoje e a janela anterior é o dia inteiro de ontem", () => {
    const now = new Date();
    const range = resolvePeriod({ period: "today" });

    expect(range.currentStart).toEqual(startOfDay(now));
    expect(range.currentEnd).toEqual(endOfDay(now));

    const yesterday = new Date(now.getTime() - ONE_DAY_MS);
    expect(range.previousStart).toEqual(startOfDay(yesterday));
    expect(range.previousEnd).toEqual(endOfDay(yesterday));
    expect(range.granularity).toBe("day");
  });

  it("'7d' cobre os últimos 7 dias (hoje incluso) e a janela anterior são os 7 dias imediatamente antes, sem sobreposição", () => {
    const range = resolvePeriod({ period: "7d" });

    expect(startOfDay(range.currentStart)).toEqual(startOfDay(new Date(Date.now() - 6 * ONE_DAY_MS)));
    expect(range.currentEnd).toEqual(endOfDay(new Date()));

    // A janela anterior termina exatamente 1ms antes da janela atual começar (sem gap, sem overlap).
    expect(range.previousEnd.getTime()).toBe(range.currentStart.getTime() - 1);

    const previousSpanDays =
      Math.round(
        (startOfDay(range.previousEnd).getTime() - startOfDay(range.previousStart).getTime()) / ONE_DAY_MS,
      ) + 1;
    expect(previousSpanDays).toBe(7);
    expect(range.granularity).toBe("day");
  });

  it("'30d' desloca a janela anterior por 30 dias completos, com a mesma duração exata da janela atual", () => {
    const range = resolvePeriod({ period: "30d" });

    expect(range.previousEnd.getTime()).toBe(range.currentStart.getTime() - 1);
    const spanMs = range.currentEnd.getTime() - range.currentStart.getTime();
    const previousSpanMs = range.previousEnd.getTime() - range.previousStart.getTime();
    expect(previousSpanMs).toBe(spanMs);
  });

  it("'custom' aceita um intervalo válido e desloca a janela anterior pelo mesmo número de dias", () => {
    const range = resolvePeriod({ period: "custom", start: "2026-01-01", end: "2026-01-10" });

    // `new Date(year, month, day)` (construtor local), não `new Date("YYYY-MM-DD")` (parseado como
    // UTC pelo `Date` nativo) — ver o regression test de `parseDateInput` logo abaixo.
    expect(range.currentStart).toEqual(startOfDay(new Date(2026, 0, 1)));
    expect(range.currentEnd).toEqual(endOfDay(new Date(2026, 0, 10)));
    expect(range.previousEnd.getTime()).toBe(range.currentStart.getTime() - 1);
    expect(range.previousStart).toEqual(startOfDay(new Date(2025, 11, 22)));
    expect(range.granularity).toBe("day");
  });

  it("'custom' com intervalo maior que 60 dias usa granularidade mensal", () => {
    const range = resolvePeriod({ period: "custom", start: "2026-01-01", end: "2026-04-01" });
    expect(range.granularity).toBe("month");
  });

  it("'custom' sem start/end lança ValidationError", () => {
    expect(() => resolvePeriod({ period: "custom" })).toThrow(/start.*end/i);
  });

  it("'custom' com start depois de end lança ValidationError", () => {
    expect(() => resolvePeriod({ period: "custom", start: "2026-01-10", end: "2026-01-01" })).toThrow(
      /anterior ou igual/i,
    );
  });

  it("'custom' com data inválida lança ValidationError", () => {
    expect(() => resolvePeriod({ period: "custom", start: "not-a-date", end: "2026-01-01" })).toThrow(
      /inválidas/i,
    );
  });

  it("'custom' com intervalo maior que 400 dias lança ValidationError", () => {
    expect(() => resolvePeriod({ period: "custom", start: "2020-01-01", end: "2026-01-01" })).toThrow(
      /400 dias/i,
    );
  });

  it("'all' cobre desde a época até hoje, com granularidade mensal e sem 'unbounded' nos demais períodos", () => {
    const range = resolvePeriod({ period: "all" });

    expect(range.currentStart).toEqual(new Date(0));
    expect(range.currentEnd).toEqual(endOfDay(new Date()));
    expect(range.granularity).toBe("month");
    expect(range.unbounded).toBe(true);

    expect(resolvePeriod({ period: "today" }).unbounded).toBe(false);
  });

  it("'all' desloca a janela anterior pra antes da época — nenhum dado real bate nela", () => {
    const range = resolvePeriod({ period: "all" });
    expect(range.previousEnd.getTime()).toBeLessThan(new Date(0).getTime());
    expect(range.previousStart.getTime()).toBeLessThan(range.previousEnd.getTime());
  });

  it("'custom' com datas 'YYYY-MM-DD' (sem hora) não desalinha um dia inteiro contra o fuso local", () => {
    // Regressão: `new Date("2026-02-03")` (sem hora) é interpretado como meia-noite UTC, não local —
    // sem o fix em `parseDateInput`, `startOfDay`/`endOfDay` (que operam em hora local) deslocavam a
    // janela inteira ~1 dia pra trás em fusos negativos (ex.: Brasília, UTC-3).
    const range = resolvePeriod({ period: "custom", start: "2026-02-03", end: "2026-02-04" });
    expect(range.currentStart).toEqual(startOfDay(new Date(2026, 1, 3)));
    expect(range.currentEnd).toEqual(endOfDay(new Date(2026, 1, 4)));
  });
});
