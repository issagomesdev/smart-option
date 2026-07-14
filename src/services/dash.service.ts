import { and, count, eq, gte, inArray, lte, asc } from "drizzle-orm";
import { db } from "../infrastructure/database/client";
import { botUsers, products, userPlans, walletTransactions } from "../infrastructure/database/schema";
import { ValidationError } from "../shared/errors";

const BR_DATE = /^(\d{2})-(\d{2})-(\d{4})$/;

/** Converte "DD-MM-YYYY - DD-MM-YYYY" (formato enviado pelo painel) em datas reais, validando o formato em vez de interpolar direto na query. */
function parseDateRange(interval: string): { start: Date; end: Date } {
  const [startRaw, endRaw] = interval.split(" - ").map((part) => part.trim());
  const start = parseBrDate(startRaw);
  const end = parseBrDate(endRaw);
  if (!start || !end) {
    throw new ValidationError("Período inválido — use o formato DD-MM-YYYY - DD-MM-YYYY");
  }
  return { start, end };
}

function parseBrDate(value: string | undefined): Date | null {
  const match = value ? BR_DATE.exec(value) : null;
  if (!match) return null;
  const [, day, month, year] = match;
  const date = new Date(Number(year), Number(month) - 1, Number(day));
  return Number.isNaN(date.getTime()) ? null : date;
}

const PRODUCT_TIERS = [
  { key: "bronzeUsers", productId: 1 },
  { key: "silverUsers", productId: 2 },
  { key: "goldUsers", productId: 3 },
  { key: "diamondUsers", productId: 4 },
] as const;

export class DashboardService {
  static async users() {
    const [{ total: allUsers }] = await db.select({ total: count() }).from(botUsers);

    const [{ total: activeUsers }] = await db
      .select({ total: count() })
      .from(botUsers)
      .innerJoin(userPlans, eq(botUsers.id, userPlans.userId))
      .where(eq(userPlans.status, 1));

    const tierCounts = await Promise.all(
      PRODUCT_TIERS.map(async ({ productId }) => {
        const [{ total }] = await db
          .select({ total: count() })
          .from(botUsers)
          .innerJoin(userPlans, eq(botUsers.id, userPlans.userId))
          .where(and(eq(userPlans.status, 1), eq(userPlans.productId, productId)));
        return total;
      }),
    );

    return {
      allUsers,
      activeUsers,
      bronzeUsers: tierCounts[0],
      silverUsers: tierCounts[1],
      goldUsers: tierCounts[2],
      diamondUsers: tierCounts[3],
    };
  }

  /** Somas calculadas sobre `wallet_transactions` (o ledger vigente desde a Fase 4). */
  static async balance(userId: string, productId: string, interval: string) {
    const range = interval !== "all" ? parseDateRange(interval) : null;

    let userIdsForProduct: number[] | null = null;
    if (productId !== "all") {
      const rows = await db
        .select({ userId: userPlans.userId })
        .from(userPlans)
        .where(eq(userPlans.productId, Number(productId)));
      userIdsForProduct = rows.map((row) => row.userId);
    }

    const total = async (origin?: "earnings" | "profitability"): Promise<number> => {
      if (userIdsForProduct && userIdsForProduct.length === 0) return 0;

      const conditions = [];
      if (userId !== "all") conditions.push(eq(walletTransactions.userId, Number(userId)));
      if (userIdsForProduct) conditions.push(inArray(walletTransactions.userId, userIdsForProduct));
      if (origin) conditions.push(eq(walletTransactions.origin, origin));
      if (range) {
        conditions.push(gte(walletTransactions.createdAt, range.start));
        conditions.push(lte(walletTransactions.createdAt, range.end));
      }

      const rows = await db
        .select({ direction: walletTransactions.direction, amount: walletTransactions.amount })
        .from(walletTransactions)
        .where(conditions.length ? and(...conditions) : undefined);

      const sum = rows.reduce((acc, row) => acc + (row.direction === "credit" ? 1 : -1) * Number(row.amount), 0);
      return Math.floor(sum * 100) / 100;
    };

    return [
      { name: "Total na Plataforma (R$)", value: await total() },
      { name: "Rentabilidade da rede (R$)", value: await total("earnings") },
      { name: "Repasse da rede (R$)", value: await total("profitability") },
    ];
  }

  static async getPlans() {
    return db
      .select({ id: products.id, name: products.name })
      .from(products)
      .where(eq(products.purchaseType, "auto"))
      .orderBy(asc(products.id));
  }
}
