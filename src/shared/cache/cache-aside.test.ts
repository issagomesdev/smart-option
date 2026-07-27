import { afterEach, describe, expect, it, vi } from "vitest";
import { redis } from "../../infrastructure/cache/redis";
import { getOrSet } from "./cache-aside";

describe("getOrSet (cache-aside, Redis real)", () => {
  const keysToClean: string[] = [];

  afterEach(async () => {
    while (keysToClean.length > 0) {
      await redis.del(keysToClean.pop()!);
    }
  });

  it("na primeira chamada executa fn e grava o resultado no Redis", async () => {
    const key = `test:cache-aside:${Date.now()}:miss`;
    keysToClean.push(key);
    const fn = vi.fn().mockResolvedValue({ total: 42 });

    const result = await getOrSet(key, 30, fn);

    expect(result).toEqual({ total: 42 });
    expect(fn).toHaveBeenCalledTimes(1);
    expect(await redis.get(key)).toBe(JSON.stringify({ total: 42 }));
  });

  it("numa segunda chamada dentro do TTL, devolve do cache sem executar fn de novo", async () => {
    const key = `test:cache-aside:${Date.now()}:hit`;
    keysToClean.push(key);
    const fn = vi.fn().mockResolvedValue({ total: 7 });

    const first = await getOrSet(key, 30, fn);
    const second = await getOrSet(key, 30, fn);

    expect(first).toEqual(second);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("um valor do tipo Date sobrevive ao round-trip de cache como Date de verdade, não como string", async () => {
    const key = `test:cache-aside:${Date.now()}:date`;
    keysToClean.push(key);
    const createdAt = new Date("2026-03-15T14:30:00.000Z");
    const fn = vi.fn().mockResolvedValue({ createdAt });

    const first = await getOrSet<{ createdAt: Date }>(key, 30, fn);
    const second = await getOrSet<{ createdAt: Date }>(key, 30, fn);

    expect(first.createdAt).toBeInstanceOf(Date);
    expect(second.createdAt).toBeInstanceOf(Date);
    expect(second.createdAt.getTime()).toBe(createdAt.getTime());
  });

  it("depois do TTL expirar, executa fn de novo", async () => {
    const key = `test:cache-aside:${Date.now()}:expired`;
    keysToClean.push(key);
    const fn = vi.fn().mockResolvedValueOnce({ total: 1 }).mockResolvedValueOnce({ total: 2 });

    await getOrSet(key, 1, fn);
    await new Promise((resolve) => setTimeout(resolve, 1100));
    const second = await getOrSet(key, 1, fn);

    expect(second).toEqual({ total: 2 });
    expect(fn).toHaveBeenCalledTimes(2);
  });
});
