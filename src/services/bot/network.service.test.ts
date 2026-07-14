import { and, eq, inArray } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "../../infrastructure/database/client";
import { affiliateNetwork, botUsers, productEarnings, products, userPlans, walletTransactions, wallets } from "../../infrastructure/database/schema";
import { walletService } from "../../wallet/wallet.service";
import { NetworkService } from "./network.service";

describe("NetworkService (integração, banco real)", () => {
  let productId: number;
  const userIds: number[] = [];

  async function createUser(name: string): Promise<number> {
    const [user] = await db
      .insert(botUsers)
      .values({
        name,
        email: `${name.toLowerCase()}-${Date.now()}-${Math.random().toString(36).slice(2)}@test.local`,
        password: "x",
        phoneNumber: "11900000000",
        adress: "Rua Teste, 1",
        pixCode: "chave-teste",
      })
      .$returningId();
    userIds.push(user.id);
    return user.id;
  }

  async function givePlan(userId: number): Promise<void> {
    await db.insert(userPlans).values({ userId, productId, status: 1, expiredIn: new Date(Date.now() + 30 * 86400_000) });
  }

  beforeAll(async () => {
    const [product] = await db
      .insert(products)
      .values({ name: `Network Test Plan ${Date.now()}`, description: "-", price: "100.00", earningsMonthly: "8.00", purchaseType: "auto" })
      .$returningId();
    productId = product.id;

    await db.insert(productEarnings).values([
      { productId, level: "1", type: "subscription", percentage: "20.00" },
      { productId, level: "2", type: "subscription", percentage: "10.00" },
      { productId, level: "3", type: "subscription", percentage: "5.00" },
      { productId, level: "1", type: "earnings", percentage: "15.00" },
      { productId, level: "2", type: "earnings", percentage: "8.00" },
      { productId, level: "3", type: "earnings", percentage: "3.00" },
    ]);
  });

  afterAll(async () => {
    await db.delete(walletTransactions).where(inArray(walletTransactions.userId, userIds));
    await db.delete(wallets).where(inArray(wallets.userId, userIds));
    await db.delete(userPlans).where(inArray(userPlans.userId, userIds));
    await db.delete(affiliateNetwork).where(inArray(affiliateNetwork.guestUserId, userIds));
    await db.delete(botUsers).where(inArray(botUsers.id, userIds));
    await db.delete(productEarnings).where(eq(productEarnings.productId, productId));
    await db.delete(products).where(eq(products.id, productId));
  });

  it("upNetwork grava os 3 níveis de patrocinador acima do indicado numa cadeia reta", async () => {
    const a = await createUser("NetA");
    const b = await createUser("NetB");
    const c = await createUser("NetC");
    const d = await createUser("NetD");

    await NetworkService.upNetwork(a, b);
    await NetworkService.upNetwork(b, c);
    await NetworkService.upNetwork(c, d);

    const dEdges = await db.select().from(affiliateNetwork).where(eq(affiliateNetwork.guestUserId, d)).orderBy(affiliateNetwork.level);

    expect(dEdges).toHaveLength(3);
    expect(dEdges.map((e) => e.affiliateUserId)).toEqual([c, b, a]);
    // Primeiro (e único, neste teste) indicado de cada patrocinador em cada nível — sempre dentro do teto de 3.
    expect(dEdges.every((e) => e.earnings === 1)).toBe(true);
  });

  it("upNetwork zera earnings a partir do 4º indicado no mesmo nível (teto de comissão)", async () => {
    const sponsor = await createUser("CapSponsor");
    const guests = [await createUser("CapGuest1"), await createUser("CapGuest2"), await createUser("CapGuest3"), await createUser("CapGuest4")];

    for (const guestId of guests) {
      await NetworkService.upNetwork(sponsor, guestId);
    }

    const edges = await db
      .select()
      .from(affiliateNetwork)
      .where(and(eq(affiliateNetwork.affiliateUserId, sponsor), eq(affiliateNetwork.level, "1")))
      .orderBy(affiliateNetwork.id);

    expect(edges.map((e) => e.earnings)).toEqual([1, 1, 1, 0]);
  });

  it("networkRepass credita o afiliado direto (nível 1) com a porcentagem configurada, com idempotência", async () => {
    const sponsor = await createUser("RepassSponsor");
    const buyer = await createUser("RepassBuyer");
    await NetworkService.upNetwork(sponsor, buyer);
    await givePlan(sponsor);

    const sourceKey = `test:${uuidv4()}`;
    await NetworkService.networkRepass(buyer, 1000, "subscription", sourceKey);

    // 20% de 1000 = 200.
    expect(await walletService.getBalance(sponsor)).toBe(200);

    // Reprocessar o mesmo evento de origem não duplica o repasse.
    await NetworkService.networkRepass(buyer, 1000, "subscription", sourceKey);
    expect(await walletService.getBalance(sponsor)).toBe(200);
  });

  it("networkRepass não credita um afiliado sem plano ativo", async () => {
    const sponsor = await createUser("NoPlanSponsor");
    const buyer = await createUser("NoPlanBuyer");
    await NetworkService.upNetwork(sponsor, buyer);
    // Sem givePlan(sponsor) — patrocinador sem plano ativo.

    await NetworkService.networkRepass(buyer, 1000, "subscription", `test:${uuidv4()}`);

    expect(await walletService.getBalance(sponsor)).toBe(0);
  });

  it("networkRepass do tipo 'earnings' só credita afiliados cujo vínculo tem earnings=1", async () => {
    const sponsor = await createUser("EarningsSponsor");
    const buyer = await createUser("EarningsBuyer");
    await NetworkService.upNetwork(sponsor, buyer);
    await givePlan(sponsor);

    await db
      .update(affiliateNetwork)
      .set({ earnings: 0 })
      .where(and(eq(affiliateNetwork.affiliateUserId, sponsor), eq(affiliateNetwork.guestUserId, buyer), eq(affiliateNetwork.level, "1")));

    await NetworkService.networkRepass(buyer, 1000, "earnings", `test:${uuidv4()}`);

    expect(await walletService.getBalance(sponsor)).toBe(0);
  });
});
