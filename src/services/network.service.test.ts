import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "../infrastructure/database/client";
import { affiliateNetwork, botUsers } from "../infrastructure/database/schema";
import { NetworkService } from "./network.service";

/**
 * Fase 0 (pré-requisito do painel admin): `POST /network/:id` passou a
 * suportar `page`/`limit` server-side, aplicado independentemente às listas
 * `guests` e `affiliates`. Este teste garante que o total bate com o
 * conjunto inteiro e que as páginas não se sobrepõem/pulam registros.
 */
describe("NetworkService.network (paginação, banco real)", () => {
  let affiliateUserId: number;
  const guestUserIds: number[] = [];
  const stamp = Date.now();

  beforeAll(async () => {
    const [affiliate] = await db
      .insert(botUsers)
      .values({
        name: "Pagination Network Affiliate",
        email: `pagination-network-affiliate-${stamp}@test.local`,
        password: "x",
        phoneNumber: "11900000000",
        adress: "Rua Teste, 1",
        pixCode: "chave-pix-teste",
      })
      .$returningId();
    affiliateUserId = affiliate.id;

    for (let i = 0; i < 5; i++) {
      const [guest] = await db
        .insert(botUsers)
        .values({
          name: `Pagination Network Guest ${i}`,
          email: `pagination-network-guest-${stamp}-${i}@test.local`,
          password: "x",
          phoneNumber: "11900000000",
          adress: "Rua Teste, 1",
          pixCode: "chave-pix-teste",
        })
        .$returningId();
      guestUserIds.push(guest.id);

      await db.insert(affiliateNetwork).values({ affiliateUserId, guestUserId: guest.id, level: "1" });
    }
  });

  afterAll(async () => {
    await db.delete(affiliateNetwork).where(eq(affiliateNetwork.affiliateUserId, affiliateUserId));
    await db.delete(botUsers).where(eq(botUsers.id, affiliateUserId));
    for (const guestId of guestUserIds) {
      await db.delete(botUsers).where(eq(botUsers.id, guestId));
    }
  });

  it("devolve o total real de guests (5) mesmo pedindo uma página menor que o total", async () => {
    const result = await NetworkService.network(affiliateUserId, { page: 1, limit: 2 });

    expect(result.guests.data).toHaveLength(2);
    expect(result.guests.pagination).toEqual({ page: 1, limit: 2, total: 5, totalPages: 3 });
    expect(result.affiliates.pagination.total).toBe(0);
  });

  it("páginas consecutivas de guests não se sobrepõem e cobrem todos os registros", async () => {
    const page1 = await NetworkService.network(affiliateUserId, { page: 1, limit: 2 });
    const page2 = await NetworkService.network(affiliateUserId, { page: 2, limit: 2 });
    const page3 = await NetworkService.network(affiliateUserId, { page: 3, limit: 2 });

    const allIds = [...page1.guests.data, ...page2.guests.data, ...page3.guests.data].map((row) => row.id);
    expect(new Set(allIds).size).toBe(5);
    expect(allIds.sort((a, b) => a - b)).toEqual([...guestUserIds].sort((a, b) => a - b));
    expect(page3.guests.data).toHaveLength(1);
  });

  it("ordena guests por name asc/desc via sortBy/sortDirection", async () => {
    const asc = await NetworkService.network(affiliateUserId, { page: 1, limit: 10, sortBy: "name", sortDirection: "asc" });
    const desc = await NetworkService.network(affiliateUserId, { page: 1, limit: 10, sortBy: "name", sortDirection: "desc" });

    expect(asc.guests.data.map((row) => row.name)).toEqual([...asc.guests.data.map((row) => row.name)].sort());
    expect(desc.guests.data.map((row) => row.name)).toEqual([...asc.guests.data.map((row) => row.name)].reverse());
  });

  it("cai no fallback (level) quando sortBy é desconhecido, sem lançar erro", async () => {
    const result = await NetworkService.network(affiliateUserId, { page: 1, limit: 10, sortBy: "not-a-real-column" });

    expect(result.guests.data).toHaveLength(5);
  });
});
