import { and, eq, like, or, sql } from "drizzle-orm";
import { db } from "../infrastructure/database/client";
import { affiliateNetwork, botUsers, userPlans } from "../infrastructure/database/schema";
import { offsetFor, paginate, type PaginationParams } from "../shared/http/pagination";
import { resolveSort } from "../shared/http/sorting";

interface NetworkFilters extends Partial<PaginationParams> {
  id?: string;
  name?: string;
  level?: string;
  status?: string;
}

const statusExpr = sql<number>`CASE WHEN ${userPlans.status} = 1 THEN 1 ELSE 0 END`;

const networkColumns = { id: botUsers.id, name: botUsers.name, level: affiliateNetwork.level, status: statusExpr };

function buildFilterConditions(filters: NetworkFilters | undefined, idColumn: typeof affiliateNetwork.guestUserId) {
  if (!filters) return [];

  const conditions = [];
  if (filters.id) conditions.push(like(sql`CAST(${idColumn} AS CHAR)`, `%${filters.id}%`));
  if (filters.name) conditions.push(like(botUsers.name, `%${filters.name}%`));
  if (filters.level && filters.level !== "all") conditions.push(eq(affiliateNetwork.level, filters.level as "1" | "2" | "3"));
  if (filters.status && filters.status !== "all") {
    conditions.push(
      filters.status === "0"
        ? or(eq(statusExpr, 0), sql`${userPlans.status} IS NULL`)
        : eq(statusExpr, Number(filters.status)),
    );
  }
  return conditions;
}

export class NetworkService {
  static async network(userId: number, filters?: NetworkFilters) {
    const page = filters?.page ?? 1;
    const limit = filters?.limit ?? 20;
    const offset = offsetFor({ page, limit });
    const orderBy = resolveSort(networkColumns, filters, affiliateNetwork.level);

    const guestsWhere = and(eq(affiliateNetwork.affiliateUserId, userId), ...buildFilterConditions(filters, affiliateNetwork.guestUserId));
    const affiliatesWhere = and(eq(affiliateNetwork.guestUserId, userId), ...buildFilterConditions(filters, affiliateNetwork.affiliateUserId));

    const [guestRows, [{ total: guestsTotal }], affiliateRows, [{ total: affiliatesTotal }]] = await Promise.all([
      db
        .select(networkColumns)
        .from(botUsers)
        .innerJoin(affiliateNetwork, eq(botUsers.id, affiliateNetwork.guestUserId))
        .leftJoin(userPlans, eq(botUsers.id, userPlans.userId))
        .where(guestsWhere)
        .orderBy(orderBy)
        .limit(limit)
        .offset(offset),
      db
        .select({ total: sql<number>`count(*)` })
        .from(botUsers)
        .innerJoin(affiliateNetwork, eq(botUsers.id, affiliateNetwork.guestUserId))
        .leftJoin(userPlans, eq(botUsers.id, userPlans.userId))
        .where(guestsWhere),
      db
        .select(networkColumns)
        .from(botUsers)
        .innerJoin(affiliateNetwork, eq(botUsers.id, affiliateNetwork.affiliateUserId))
        .leftJoin(userPlans, eq(botUsers.id, userPlans.userId))
        .where(affiliatesWhere)
        .orderBy(orderBy)
        .limit(limit)
        .offset(offset),
      db
        .select({ total: sql<number>`count(*)` })
        .from(botUsers)
        .innerJoin(affiliateNetwork, eq(botUsers.id, affiliateNetwork.affiliateUserId))
        .leftJoin(userPlans, eq(botUsers.id, userPlans.userId))
        .where(affiliatesWhere),
    ]);

    return {
      guests: paginate(guestRows, { page, limit }, Number(guestsTotal)),
      affiliates: paginate(affiliateRows, { page, limit }, Number(affiliatesTotal)),
    };
  }
}
