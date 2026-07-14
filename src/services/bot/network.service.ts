import { and, eq, sql } from "drizzle-orm";
import { db } from "../../infrastructure/database/client";
import { affiliateNetwork as affiliateNetworkTable, botUsers, productEarnings, userPlans } from "../../infrastructure/database/schema";
import { walletService, WalletOrigin } from "../../wallet/wallet.service";

type NetworkLevel = "1" | "2" | "3";
const LEVELS: NetworkLevel[] = ["1", "2", "3"];

export class NetworkService {
  static async affiliateNetwork(telegramUserId: number) {
    const [user] = await db.select().from(botUsers).where(eq(botUsers.telegramUserId, String(telegramUserId)));
    if (!user) return [];

    const rows = await db
      .select({
        name: botUsers.name,
        id: botUsers.id,
        level: affiliateNetworkTable.level,
        planStatus: userPlans.status,
      })
      .from(affiliateNetworkTable)
      .innerJoin(botUsers, eq(botUsers.id, affiliateNetworkTable.guestUserId))
      .leftJoin(userPlans, eq(userPlans.userId, botUsers.id))
      .where(eq(affiliateNetworkTable.affiliateUserId, user.id))
      .orderBy(affiliateNetworkTable.level);

    return rows.map((row) => ({ ...row, status: row.planStatus === 1 ? 1 : 0 }));
  }

  static async earningsPercentage(productId: number, type: "subscription" | "earnings", level: NetworkLevel): Promise<number> {
    const [row] = await db
      .select({ percentage: productEarnings.percentage })
      .from(productEarnings)
      .where(and(eq(productEarnings.productId, productId), eq(productEarnings.level, level), eq(productEarnings.type, type)));

    return row ? Number(row.percentage) : 0;
  }

  /**
   * Repassa comissão de até 3 níveis de afiliados acima de `userId`. Cada
   * nível só recebe se tiver plano ativo e estiver entre os 3 primeiros
   * afiliados daquele nível marcados com `earnings=1` (mesma regra de cap
   * que já existia). `sourceIdempotencyKey` identifica o evento de origem
   * (ex.: `payment_transaction:42`, `earnings:7:2026-07-12`) — cada nível
   * gera sua própria chave derivada, então reprocessar o evento de origem
   * nunca duplica o repasse.
   */
  static async networkRepass(
    userId: number,
    value: number,
    type: "subscription" | "earnings",
    sourceIdempotencyKey: string,
    profitability = false,
  ): Promise<void> {
    let currentGuestId = userId;

    for (const level of LEVELS) {
      const [edge] = await db
        .select()
        .from(affiliateNetworkTable)
        .where(
          and(
            eq(affiliateNetworkTable.guestUserId, currentGuestId),
            eq(affiliateNetworkTable.level, level),
            ...(type === "earnings" ? [eq(affiliateNetworkTable.earnings, 1)] : []),
          ),
        );

      if (!edge) break;

      const [hasPlan] = await db
        .select({ productId: userPlans.productId })
        .from(userPlans)
        .where(and(eq(userPlans.userId, edge.affiliateUserId), eq(userPlans.status, 1)));

      if (hasPlan) {
        const percentage = await NetworkService.earningsPercentage(hasPlan.productId, type, level);

        if (percentage > 0) {
          const origin: WalletOrigin = profitability ? "profitability" : "subscription";
          await walletService.credit({
            userId: edge.affiliateUserId,
            amount: Math.round((percentage / 100) * value * 100) / 100,
            origin,
            idempotencyKey: `${sourceIdempotencyKey}:repass:L${level}`,
            referenceType: "bot_users",
            referenceId: String(userId),
          });
        }
      }

      currentGuestId = edge.affiliateUserId;
    }
  }

  /** Insere o novo usuário na árvore de afiliados de até 3 níveis acima do indicador. */
  static async upNetwork(affiliateId: number, guestId: number): Promise<void> {
    let currentAffiliateId: number | undefined = affiliateId;

    for (const level of LEVELS) {
      if (!currentAffiliateId) break;

      const [{ count }] = await db
        .select({ count: sql<number>`count(*)` })
        .from(affiliateNetworkTable)
        .where(
          and(
            eq(affiliateNetworkTable.affiliateUserId, currentAffiliateId),
            eq(affiliateNetworkTable.level, level),
            eq(affiliateNetworkTable.earnings, 1),
          ),
        );

      await db.insert(affiliateNetworkTable).values({
        affiliateUserId: currentAffiliateId,
        guestUserId: guestId,
        level,
        earnings: count < 3 ? 1 : 0,
      });

      const [parentEdge] = await db
        .select()
        .from(affiliateNetworkTable)
        .where(and(eq(affiliateNetworkTable.guestUserId, currentAffiliateId), eq(affiliateNetworkTable.level, "1")));

      currentAffiliateId = parentEdge?.affiliateUserId;
    }
  }
}
