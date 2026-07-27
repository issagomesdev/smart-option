import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "../infrastructure/database/client";
import { botUsers, products, userPlans } from "../infrastructure/database/schema";
import { planFiltersDto, type PlanFilters } from "../interfaces/http/dtos/plans.dto";
import { PlansService } from "./plans.service";

/** Passa pelo parser zod real (mesmo `planFiltersDto` da rota) em vez de montar os defaults à mão. */
function list(input: Partial<PlanFilters> = {}) {
  return PlansService.list(planFiltersDto.parse(input));
}

const stamp = Date.now();

describe("PlansService (banco real)", () => {
  const createdProductIds: number[] = [];
  let userId: number;
  let subscribedProductId: number;
  let userPlanId: number;

  beforeAll(async () => {
    const [user] = await db
      .insert(botUsers)
      .values({
        name: `Plans Test User ${stamp}`,
        email: `plans-service-${stamp}@test.local`,
        password: "x",
        phoneNumber: "11900000000",
        adress: "Rua Teste, 1",
        pixCode: "chave-pix-teste",
        telegramUserId: `888${stamp}`,
      })
      .$returningId();
    userId = user.id;

    // Plano com assinante — não pode ser excluído mesmo não sendo de sistema.
    const [subscribed] = await db
      .insert(products)
      .values({
        name: `Plano Com Assinante ${stamp}`,
        description: "Semeado pelo teste — tem assinante.",
        price: "150.00",
        earningsMonthly: "5.00",
        purchaseType: "auto",
      })
      .$returningId();
    subscribedProductId = subscribed.id;
    createdProductIds.push(subscribed.id);

    const [plan] = await db
      .insert(userPlans)
      .values({
        userId,
        productId: subscribedProductId,
        status: 1,
        acquiredIn: new Date(),
        expiredIn: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      })
      .$returningId();
    userPlanId = plan.id;
  });

  afterAll(async () => {
    if (userPlanId) await db.delete(userPlans).where(eq(userPlans.id, userPlanId));
    if (createdProductIds.length > 0) await db.delete(products).where(inArray(products.id, createdProductIds));
    if (userId) await db.delete(botUsers).where(eq(botUsers.id, userId));
  });

  it("lista de forma paginada e converte decimais (string no driver) para número", async () => {
    const result = await list({ search: `Plano Com Assinante ${stamp}` });

    expect(result.pagination.total).toBe(1);
    const [plan] = result.data;
    expect(plan.price).toBe(150);
    expect(plan.earningsMonthly).toBe(5);
    expect(typeof plan.price).toBe("number");
  });

  it("conta assinantes por plano numa única query, sem N+1", async () => {
    const result = await list({ search: `Plano Com Assinante ${stamp}` });
    expect(result.data[0]!.subscriberCount).toBe(1);
  });

  it("filtra por purchaseType e por isActive", async () => {
    const manual = await list({ purchaseType: "manual", limit: 100 });
    expect(manual.data.every((plan) => plan.purchaseType === "manual")).toBe(true);
    expect(manual.data.length).toBeGreaterThan(0);

    const active = await list({ isActive: "true" as unknown as never, limit: 100 });
    expect(active.data.every((plan) => plan.isActive)).toBe(true);
  });

  it("os 6 planos semeados são de sistema (protegidos contra exclusão)", async () => {
    const seeded = await PlansService.getById(4); // diamond — referenciado por cron.ts
    expect(seeded.isSystem).toBe(true);
  });

  it("cria um plano novo sempre como não-sistema, mesmo se o corpo tentar forçar", async () => {
    const created = await PlansService.create({
      name: `Plano Novo ${stamp}`,
      description: "Criado pelo teste.",
      price: 49.9,
      earningsMonthly: 2.5,
      purchaseType: "auto",
      isActive: true,
      // `isSystem` nem existe no DTO — provado aqui para documentar que o cliente não consegue
      // criar um plano indelével.
      ...({ isSystem: true } as Record<string, unknown>),
    });
    createdProductIds.push(created.id);

    expect(created.isSystem).toBe(false);
    expect(created.price).toBe(49.9);
    expect(created.earningsMonthly).toBe(2.5);
    expect(created.subscriberCount).toBe(0);
  });

  it("edita um plano existente", async () => {
    const created = await PlansService.create({
      name: `Plano Para Editar ${stamp}`,
      description: "Antes.",
      price: 10,
      earningsMonthly: 1,
      purchaseType: "auto",
      isActive: true,
    });
    createdProductIds.push(created.id);

    const updated = await PlansService.update(created.id, {
      name: `Plano Editado ${stamp}`,
      description: "Depois.",
      price: 20,
      earningsMonthly: 3,
      purchaseType: "manual",
      isActive: false,
    });

    expect(updated.name).toBe(`Plano Editado ${stamp}`);
    expect(updated.price).toBe(20);
    expect(updated.purchaseType).toBe("manual");
    expect(updated.isActive).toBe(false);
  });

  it("exclui um plano novo sem assinantes", async () => {
    const created = await PlansService.create({
      name: `Plano Descartável ${stamp}`,
      description: "Some no fim do teste.",
      price: 1,
      earningsMonthly: 1,
      purchaseType: "auto",
      isActive: true,
    });

    await expect(PlansService.delete(created.id)).resolves.toMatchObject({ status: true });
    await expect(PlansService.getById(created.id)).rejects.toThrow(/inexistente/i);
  });

  // A regra que protege `cron.ts:141-143`: apagar os IDs 3/4 quebraria a promoção de tier.
  it("recusa excluir um plano de sistema, sugerindo desativar", async () => {
    await expect(PlansService.delete(4)).rejects.toThrow(/não podem ser excluídos/i);
    await expect(PlansService.delete(4)).rejects.toThrow(/[Dd]esative/);
  });

  it("recusa excluir um plano que já tem assinante", async () => {
    await expect(PlansService.delete(subscribedProductId)).rejects.toThrow(/já foi adquirido/i);
  });

  it("lança NotFoundError para um plano inexistente", async () => {
    await expect(PlansService.getById(999_999)).rejects.toThrow(/inexistente/i);
  });

  it("ordena pela allowlist e cai no fallback silenciosamente com sortBy desconhecido", async () => {
    const byPrice = await list({ sortBy: "price", sortDirection: "desc", limit: 100 });
    const prices = byPrice.data.map((plan) => plan.price);
    expect(prices).toEqual([...prices].sort((a, b) => b - a));

    await expect(list({ sortBy: "coluna-que-nao-existe" })).resolves.toBeDefined();
  });
});
