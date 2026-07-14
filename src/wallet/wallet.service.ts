import { and, eq, sql } from "drizzle-orm";
import { db } from "../infrastructure/database/client";
import { wallets, walletTransactions } from "../infrastructure/database/schema";
import { ConflictError } from "../shared/errors";
import { applyDirection, fromCents, toCents } from "./wallet.math";

export type WalletDirection = "credit" | "debit";

export type WalletOrigin =
  | "deposit"
  | "withdrawal"
  | "earnings"
  | "profitability"
  | "subscription"
  | "tuition"
  | "transfer_in"
  | "transfer_out"
  | "admin_adjustment"
  | "diamond_tax";

export interface LedgerEntryParams {
  userId: number;
  /** Sempre positivo — o sentido (crédito/débito) é dado pelo método chamado, não pelo sinal. */
  amount: number;
  origin: WalletOrigin;
  /** Chave única da operação de negócio (ex.: `payment_transaction:42`, `network_repass:99:L1`). Garante que reprocessar um evento não duplica o lançamento. */
  idempotencyKey: string;
  referenceType?: string;
  referenceId?: string;
  metadata?: Record<string, unknown>;
  /** Só usado em débitos. Default `false`: débito que deixaria o saldo negativo lança `ConflictError`. */
  allowNegative?: boolean;
}

export interface LedgerEntryResult {
  balanceAfter: number;
  /** `true` quando a `idempotencyKey` já tinha sido processada — nenhum lançamento novo foi criado. */
  duplicate: boolean;
}

/**
 * Único ponto permitido de mutação de saldo da aplicação. Todo crédito/débito
 * vira uma linha em `wallet_transactions` dentro de uma transação de banco
 * que também atualiza o saldo materializado em `wallet` — nunca um UPDATE
 * solto. A linha é sempre travada (`SELECT ... FOR UPDATE`) antes de ler o
 * saldo corrente, para que operações concorrentes no mesmo usuário serializem
 * em vez de perderem uma atualização.
 */
export class WalletService {
  async getBalance(userId: number): Promise<number> {
    const [wallet] = await db.select().from(wallets).where(eq(wallets.userId, userId));
    return wallet ? Number(wallet.balance) : 0;
  }

  /**
   * Soma do ledger excluindo créditos de `earnings` do mês corrente — usado
   * apenas pelo cálculo de rentabilidade diária, que precisa do saldo
   * "principal" para não compor sobre ganhos já creditados no mesmo mês
   * (mesma regra que existia em `TransactionsService.balance(id, false)`).
   */
  async getBalanceExcludingCurrentMonthEarnings(userId: number): Promise<number> {
    const rows = await db
      .select({ direction: walletTransactions.direction, amount: walletTransactions.amount })
      .from(walletTransactions)
      .where(
        and(
          eq(walletTransactions.userId, userId),
          sql`NOT (${walletTransactions.origin} = 'earnings' AND DATE_FORMAT(${walletTransactions.createdAt}, '%Y-%m') = DATE_FORMAT(CURRENT_DATE(), '%Y-%m'))`,
        ),
      );

    const totalCents = rows.reduce(
      (acc, row) => applyDirection(acc, toCents(row.amount), row.direction as WalletDirection),
      0,
    );

    return Number(fromCents(totalCents));
  }

  async credit(params: LedgerEntryParams): Promise<LedgerEntryResult> {
    return this.applyEntry("credit", params);
  }

  async debit(params: LedgerEntryParams): Promise<LedgerEntryResult> {
    return this.applyEntry("debit", params);
  }

  /** Débito + crédito atômicos entre dois usuários — nunca passa por gateway algum. */
  async transferBetweenUsers(params: {
    fromUserId: number;
    toUserId: number;
    amount: number;
    idempotencyKey: string;
  }): Promise<{ senderBalanceAfter: number; recipientBalanceAfter: number }> {
    const debitResult = await this.debit({
      userId: params.fromUserId,
      amount: params.amount,
      origin: "transfer_out",
      idempotencyKey: `${params.idempotencyKey}:out`,
      referenceType: "bot_users",
      referenceId: String(params.toUserId),
    });

    const creditResult = await this.credit({
      userId: params.toUserId,
      amount: params.amount,
      origin: "transfer_in",
      idempotencyKey: `${params.idempotencyKey}:in`,
      referenceType: "bot_users",
      referenceId: String(params.fromUserId),
    });

    return { senderBalanceAfter: debitResult.balanceAfter, recipientBalanceAfter: creditResult.balanceAfter };
  }

  private async applyEntry(direction: WalletDirection, params: LedgerEntryParams): Promise<LedgerEntryResult> {
    return db.transaction(async (tx) => {
      const [existing] = await tx
        .select({ balanceAfter: walletTransactions.balanceAfter })
        .from(walletTransactions)
        .where(eq(walletTransactions.idempotencyKey, params.idempotencyKey));

      if (existing) {
        return { balanceAfter: Number(existing.balanceAfter), duplicate: true };
      }

      await tx
        .insert(wallets)
        .values({ userId: params.userId, balance: "0.00" })
        .onDuplicateKeyUpdate({ set: { userId: params.userId } });

      const [wallet] = await tx.select().from(wallets).where(eq(wallets.userId, params.userId)).for("update");

      const amountCents = toCents(params.amount);
      const newCents = applyDirection(toCents(wallet.balance), amountCents, direction);

      if (newCents < 0 && !params.allowNegative) {
        throw new ConflictError("Saldo insuficiente para completar a operação.");
      }

      const balanceAfter = fromCents(newCents);

      await tx.insert(walletTransactions).values({
        walletId: wallet.id,
        userId: params.userId,
        direction,
        origin: params.origin,
        amount: fromCents(amountCents),
        balanceAfter,
        referenceType: params.referenceType,
        referenceId: params.referenceId,
        idempotencyKey: params.idempotencyKey,
        metadata: params.metadata ?? null,
      });

      await tx.update(wallets).set({ balance: balanceAfter }).where(eq(wallets.id, wallet.id));

      return { balanceAfter: Number(balanceAfter), duplicate: false };
    });
  }
}

export const walletService = new WalletService();
