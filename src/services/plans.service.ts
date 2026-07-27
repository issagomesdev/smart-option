import { and, count, eq, like, or, type SQL } from "drizzle-orm";
import { db } from "../infrastructure/database/client";
import { products, userPlans } from "../infrastructure/database/schema";
import { ConflictError, NotFoundError } from "../shared/errors";
import { offsetFor, paginate, type PaginatedResult } from "../shared/http/pagination";
import { resolveSort } from "../shared/http/sorting";
import type { PlanFilters, PlanInput } from "../interfaces/http/dtos/plans.dto";

export interface PlanRow {
  id: number;
  name: string;
  description: string;
  price: number;
  earningsMonthly: number;
  purchaseType: "auto" | "manual";
  isSystem: boolean;
  isActive: boolean;
  /** Quantos `users_plans` referenciam este produto — alimenta o aviso de impacto e a regra de exclusão. */
  subscriberCount: number;
}

const SORT_COLUMNS = {
  id: products.id,
  name: products.name,
  price: products.price,
  earningsMonthly: products.earningsMonthly,
  purchaseType: products.purchaseType,
};

/** `decimal` volta do mysql2 como string (para não perder precisão) — a borda HTTP expõe número. */
function toRow(product: typeof products.$inferSelect, subscriberCount: number): PlanRow {
  return {
    id: product.id,
    name: product.name,
    description: product.description,
    price: Number(product.price),
    earningsMonthly: Number(product.earningsMonthly),
    purchaseType: product.purchaseType,
    isSystem: product.isSystem,
    isActive: product.isActive,
    subscriberCount,
  };
}

function buildConditions(filters: PlanFilters): SQL[] {
  const conditions: SQL[] = [];
  const search = filters.search?.trim();

  if (search) {
    conditions.push(or(like(products.name, `%${search}%`), like(products.description, `%${search}%`))!);
  }
  if (filters.purchaseType) conditions.push(eq(products.purchaseType, filters.purchaseType));
  if (filters.isActive !== undefined) conditions.push(eq(products.isActive, filters.isActive));

  return conditions;
}

/**
 * Catálogo de planos administrável pelo painel. Substitui a lista fixa que só existia no seed —
 * `DashboardService.getPlans()` continua existindo e intocado (formato `{id,name}` consumido por
 * três telas do painel), este service é a visão administrativa completa.
 *
 * `subscriberCount` sai de um LEFT JOIN + GROUP BY, e não de um subselect correlacionado em
 * `sql`...``: numa query de tabela única o Drizzle emite as colunas SEM qualificar a tabela, então
 * `(SELECT COUNT(*) FROM users_plans WHERE product_id = id)` vira `users_plans.product_id =
 * users_plans.id` — uma auto-comparação que devolve contagem errada em silêncio, sem erro de SQL
 * (bug real, pego por teste). Com o JOIN há duas tabelas em escopo e o Drizzle qualifica tudo.
 */
export class PlansService {
  static async list(filters: PlanFilters): Promise<PaginatedResult<PlanRow>> {
    const conditions = buildConditions(filters);
    const where = conditions.length > 0 ? and(...conditions) : undefined;
    const orderBy = resolveSort(SORT_COLUMNS, filters, products.id);

    const [rows, [{ total }]] = await Promise.all([
      db
        .select({ product: products, subscriberCount: count(userPlans.id) })
        .from(products)
        .leftJoin(userPlans, eq(userPlans.productId, products.id))
        .where(where)
        .groupBy(products.id)
        .orderBy(orderBy)
        .limit(filters.limit)
        .offset(offsetFor(filters)),
      // Contagem de páginas sobre `products` puro — o LEFT JOIN acima existe só para agregar
      // assinantes e não pode influenciar o total de planos.
      db.select({ total: count() }).from(products).where(where),
    ]);

    return paginate(
      rows.map((row) => toRow(row.product, Number(row.subscriberCount))),
      filters,
      total,
    );
  }

  static async getById(id: number): Promise<PlanRow> {
    const [row] = await db
      .select({ product: products, subscriberCount: count(userPlans.id) })
      .from(products)
      .leftJoin(userPlans, eq(userPlans.productId, products.id))
      .where(eq(products.id, id))
      .groupBy(products.id);

    if (!row) throw new NotFoundError("Plano inexistente");
    return toRow(row.product, Number(row.subscriberCount));
  }

  static async create(data: PlanInput): Promise<PlanRow> {
    const [created] = await db
      .insert(products)
      .values({
        name: data.name,
        description: data.description,
        price: data.price.toFixed(2),
        earningsMonthly: data.earningsMonthly.toFixed(2),
        purchaseType: data.purchaseType,
        isActive: data.isActive,
        // Planos criados pelo painel nunca são de sistema — só os semeados são, e é isso que os
        // torna não-excluíveis. Não vem do corpo da requisição de propósito: seria uma forma de o
        // cliente se tornar indelével.
        isSystem: false,
      })
      .$returningId();

    return PlansService.getById(created.id);
  }

  static async update(id: number, data: PlanInput): Promise<PlanRow> {
    const existing = await PlansService.getById(id);

    await db
      .update(products)
      .set({
        name: data.name,
        description: data.description,
        price: data.price.toFixed(2),
        earningsMonthly: data.earningsMonthly.toFixed(2),
        purchaseType: data.purchaseType,
        isActive: data.isActive,
      })
      .where(eq(products.id, existing.id));

    return PlansService.getById(id);
  }

  static async delete(id: number): Promise<{ status: true; message: string }> {
    const existing = await PlansService.getById(id);

    // Mesma regra (e mesmo formato de mensagem) de `RolesService.delete` para papéis de sistema.
    // Aqui há um motivo extra e concreto: `src/server/cron.ts:141-143` referencia os IDs 3 (gold) e
    // 4 (diamond) diretamente na promoção/rebaixamento de tier — apagá-los quebraria a rotina.
    if (existing.isSystem) {
      throw new ConflictError(
        "Planos do sistema não podem ser excluídos. Desative o plano se quiser tirá-lo de circulação.",
      );
    }

    if (existing.subscriberCount > 0) {
      throw new ConflictError(
        "Este plano já foi adquirido por pelo menos um usuário e não pode ser excluído. Desative-o para tirá-lo de circulação.",
      );
    }

    await db.delete(products).where(eq(products.id, existing.id));
    return { status: true, message: "Plano excluído com sucesso" };
  }
}
