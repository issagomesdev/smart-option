import { redis } from "../../infrastructure/cache/redis";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/;

/**
 * `JSON.parse` sozinho não reconstrói `Date` — um valor que era `Date` antes de `JSON.stringify`
 * volta como string ISO comum, então um resultado servido do cache tem um formato (em memória,
 * antes de qualquer serialização HTTP) sutilmente diferente de um resultado calculado na hora, para
 * quem chama `getOrSet` fora da borda HTTP (ex.: os testes de integração chamam `getSummary`/`list`
 * direto, sem passar pelo `res.json()` que serializaria os dois formatos de volta pro mesmo jeito).
 * Este reviver fecha essa lacuna.
 */
function reviveDates(_key: string, value: unknown): unknown {
  return typeof value === "string" && ISO_DATE.test(value) ? new Date(value) : value;
}

/**
 * Primeiro cache-aside de resultado de query do projeto (o único uso de Redis até aqui era sessão
 * do bot, `bot:session:*`). Sem invalidação por escrita de propósito: nada que escreve dado
 * financeiro passa por este helper, então a única garantia de atualidade é o TTL — uma janela curta
 * o suficiente pra ser imperceptível é preferível a inventar um mecanismo de invalidação para um
 * único consumidor (o agregador do dashboard).
 */
export async function getOrSet<T>(key: string, ttlSeconds: number, fn: () => Promise<T>): Promise<T> {
  const cached = await redis.get(key);
  if (cached !== null) {
    return JSON.parse(cached, reviveDates) as T;
  }

  const value = await fn();
  await redis.set(key, JSON.stringify(value), "EX", ttlSeconds);
  return value;
}
