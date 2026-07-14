import { eq, inArray } from "drizzle-orm";
import "../../../config/env";
import { db, pool } from "../client";
import { legacyBalance, walletTransactions, wallets } from "../schema";
import { logger } from "../../../shared/logger";
import { deriveWalletTransactions, LegacyBalanceRow } from "./wallet-backfill.logic";

/**
 * Popula `wallet` + `wallet_transactions` a partir do histórico acumulado em
 * `balance` (tabela legada). Idempotente: pode ser rodado quantas vezes for
 * preciso — linhas cujo `idempotency_key` já existe são puladas, e o saldo
 * final de cada wallet é sempre recalculado somando `wallet_transactions`
 * (nunca por incremento cego), então rodar de novo após novas linhas legadas
 * aparecerem apenas preenche a diferença.
 *
 * Não apaga nem altera `balance` — ela continua sendo a fonte "ao vivo" até
 * a Fase 4 migrar os services que escrevem nela.
 */
async function backfillWallets(): Promise<{ usersProcessed: number; entriesInserted: number }> {
  const userIdRows = await db
    .selectDistinct({ userId: legacyBalance.userId })
    .from(legacyBalance);

  let entriesInserted = 0;

  for (const { userId } of userIdRows) {
    const legacyRows: LegacyBalanceRow[] = await db
      .select({
        id: legacyBalance.id,
        value: legacyBalance.value,
        type: legacyBalance.type,
        origin: legacyBalance.origin,
        referenceId: legacyBalance.referenceId,
        createdAt: legacyBalance.createdAt,
      })
      .from(legacyBalance)
      .where(eq(legacyBalance.userId, userId));

    const { entries, finalBalance } = deriveWalletTransactions(legacyRows);

    const [wallet] = await db
      .insert(wallets)
      .values({ userId, balance: "0.00" })
      .onDuplicateKeyUpdate({ set: { userId } })
      .$returningId();
    const walletId = wallet?.id ?? (await db.select({ id: wallets.id }).from(wallets).where(eq(wallets.userId, userId)))[0].id;

    const existingKeys = new Set(
      (
        await db
          .select({ idempotencyKey: walletTransactions.idempotencyKey })
          .from(walletTransactions)
          .where(
            inArray(
              walletTransactions.idempotencyKey,
              entries.map((entry) => entry.idempotencyKey),
            ),
          )
      ).map((row) => row.idempotencyKey),
    );

    const toInsert = entries.filter((entry) => !existingKeys.has(entry.idempotencyKey));

    if (toInsert.length > 0) {
      await db.insert(walletTransactions).values(
        toInsert.map((entry) => ({
          walletId,
          userId,
          direction: entry.direction,
          origin: entry.origin,
          amount: entry.amount,
          balanceAfter: entry.balanceAfter,
          referenceType: entry.referenceType,
          referenceId: entry.referenceId,
          idempotencyKey: entry.idempotencyKey,
          createdAt: entry.createdAt,
        })),
      );
      entriesInserted += toInsert.length;
    }

    // Reconciliação: o saldo final é sempre a soma do ledger novo, nunca um
    // valor incrementado às cegas — é isso que torna seguro rodar de novo.
    await db.update(wallets).set({ balance: finalBalance }).where(eq(wallets.id, walletId));

    logger.info(
      { userId, legacyRows: legacyRows.length, inserted: toInsert.length, finalBalance },
      "Wallet reconciliada a partir do ledger legado",
    );
  }

  return { usersProcessed: userIdRows.length, entriesInserted };
}

backfillWallets()
  .then(async (result) => {
    logger.info(result, "Backfill de wallets concluído");
    await pool.end();
    process.exit(0);
  })
  .catch(async (err) => {
    logger.error({ err }, "Falha no backfill de wallets");
    await pool.end();
    process.exit(1);
  });

export { backfillWallets };
