import { ValidationError } from "../errors";

export type PeriodKind = "all" | "today" | "7d" | "30d" | "custom";

export interface PeriodInput {
  period: PeriodKind;
  start?: string;
  end?: string;
}

export interface PeriodRange {
  currentStart: Date;
  currentEnd: Date;
  previousStart: Date;
  previousEnd: Date;
  granularity: "day" | "month";
  /**
   * `true` só para `period: "all"` — não existe um "período anterior" que faça sentido para
   * comparar contra "desde sempre" (`previousStart`/`previousEnd` acima só existem para que os KPIs
   * continuem somando um intervalo real, sempre vazio antes da época). Consumidores que preenchem
   * baldes vazios num intervalo (o gráfico) usam esta flag para não enumerar décadas de baldes sem
   * dado nenhum antes do primeiro registro real.
   */
  unbounded: boolean;
}

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const MONTH_GRANULARITY_THRESHOLD_DAYS = 60;
const MAX_CUSTOM_RANGE_DAYS = 400;

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

function addDays(date: Date, days: number): Date {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * "YYYY-MM-DD" (sem hora — o formato que um `<input type="date">`/date-picker manda) é interpretado
 * pelo `Date` nativo como meia-noite **UTC**, não local, ao contrário de uma string com hora (que o
 * `Date` já interpreta como local) — uma inconsistência do próprio ECMAScript. Isso desalinha até um
 * dia inteiro contra `startOfDay`/`endOfDay` abaixo, que operam em hora local (confirmado
 * empiricamente: `resolvePeriod({period:"custom", start:"2026-02-03", end:"2026-02-04"})` devolvia
 * uma janela deslocada ~1 dia pra trás do esperado). Construir a partir dos componentes com o
 * construtor local (`new Date(y, m, d)`) elimina a ambiguidade só para esse formato; qualquer outra
 * string (já com hora/offset) continua indo direto para o parser nativo.
 */
function parseDateInput(value: string): Date {
  const match = DATE_ONLY.exec(value);
  if (!match) return new Date(value);
  const [, year, month, day] = match;
  return new Date(Number(year), Number(month) - 1, Number(day));
}

/**
 * Número de dias de calendário cobertos por [start, end], inclusive dos dois lados. Normaliza os
 * dois lados para meia-noite antes de subtrair — sem isso, um `end` vindo de `endOfDay` (23:59:59.999)
 * soma quase um dia inteiro a mais no resultado, contando "hoje" (um único dia) como dois.
 */
function spanInDays(start: Date, end: Date): number {
  return Math.round((startOfDay(end).getTime() - startOfDay(start).getTime()) / ONE_DAY_MS) + 1;
}

/**
 * Resolve um filtro de período (`all`/`today`/`7d`/`30d`/`custom`) em fronteiras reais de data, mais
 * a janela imediatamente anterior de mesmo tamanho (usada para calcular variação percentual/absoluta
 * nos KPIs). A regra é uma só, sem casos especiais: as duas bordas são deslocadas para trás pelo
 * mesmo número de dias que a janela atual cobre — "hoje" desloca 1 dia (ontem), "7d"/"30d"/custom
 * deslocam pelo tamanho exato do intervalo escolhido, "all" desloca por décadas (sempre cai antes da
 * época, então nunca casa com dado real — não existe "período anterior" pra "desde sempre").
 */
export function resolvePeriod(input: PeriodInput): PeriodRange {
  const now = new Date();
  let currentStart: Date;
  let currentEnd: Date;

  switch (input.period) {
    case "all": {
      // Época — sentinela seguro de "desde sempre" (nenhum registro real é anterior a 1970). A
      // regra genérica logo abaixo (janela anterior de mesmo tamanho, deslocada pra trás) continua
      // valendo: a "janela anterior" cai inteira antes da época, então nenhuma linha real bate nela
      // e os KPIs veem `previousValue = 0` — o mesmo caminho já tratado por `buildPercentageKpi`.
      currentStart = new Date(0);
      currentEnd = endOfDay(now);
      break;
    }
    case "today": {
      currentStart = startOfDay(now);
      currentEnd = endOfDay(now);
      break;
    }
    case "7d": {
      currentEnd = endOfDay(now);
      currentStart = startOfDay(addDays(now, -6));
      break;
    }
    case "30d": {
      currentEnd = endOfDay(now);
      currentStart = startOfDay(addDays(now, -29));
      break;
    }
    case "custom": {
      if (!input.start || !input.end) {
        throw new ValidationError("Período customizado exige 'start' e 'end'.");
      }

      const start = parseDateInput(input.start);
      const end = parseDateInput(input.end);
      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
        throw new ValidationError("Datas de período inválidas — use um formato ISO (YYYY-MM-DD).");
      }
      if (start.getTime() > end.getTime()) {
        throw new ValidationError("'start' deve ser anterior ou igual a 'end'.");
      }

      currentStart = startOfDay(start);
      currentEnd = endOfDay(end);

      if (spanInDays(currentStart, currentEnd) > MAX_CUSTOM_RANGE_DAYS) {
        throw new ValidationError(`Intervalo customizado não pode exceder ${MAX_CUSTOM_RANGE_DAYS} dias.`);
      }
      break;
    }
    default: {
      throw new ValidationError("Período inválido — use 'all', 'today', '7d', '30d' ou 'custom'.");
    }
  }

  const spanDays = spanInDays(currentStart, currentEnd);
  const previousEnd = endOfDay(addDays(currentStart, -1));
  const previousStart = startOfDay(addDays(previousEnd, -(spanDays - 1)));
  const granularity: "day" | "month" = spanDays > MONTH_GRANULARITY_THRESHOLD_DAYS ? "month" : "day";

  return { currentStart, currentEnd, previousStart, previousEnd, granularity, unbounded: input.period === "all" };
}
