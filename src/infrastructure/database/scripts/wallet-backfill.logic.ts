export type LegacyBalanceOrigin =
  | "deposit"
  | "withdrawal"
  | "earnings"
  | "profitability"
  | "subscription"
  | "tuition"
  | "transfer"
  | "admin"
  | "diamond_tax";

export type WalletTransactionOrigin =
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

export interface LegacyBalanceRow {
  id: number;
  value: string;
  type: "sum" | "subtract";
  origin: LegacyBalanceOrigin;
  referenceId: string | null;
  createdAt: Date;
}

export interface DerivedWalletTransaction {
  idempotencyKey: string;
  direction: "credit" | "debit";
  origin: WalletTransactionOrigin;
  amount: string;
  balanceAfter: string;
  referenceType: string;
  referenceId: string | null;
  createdAt: Date;
}

function toCents(decimalValue: string): number {
  return Math.round(Number(decimalValue) * 100);
}

function fromCents(cents: number): string {
  return (cents / 100).toFixed(2);
}

/** `origin='transfer'` na tabela legada não distingue lado da transferência — só o `type` (sum/subtract) o faz. */
function mapOrigin(row: LegacyBalanceRow): WalletTransactionOrigin {
  if (row.origin === "transfer") {
    return row.type === "sum" ? "transfer_in" : "transfer_out";
  }
  if (row.origin === "admin") {
    return "admin_adjustment";
  }
  return row.origin;
}

/**
 * Deriva as linhas de `wallet_transactions` a partir do histórico legado de
 * `balance` de um único usuário, em ordem cronológica, com o saldo corrente
 * (`balanceAfter`) recalculado a cada linha. Função pura — sem I/O — para
 * poder ser testada sem depender de um banco real.
 *
 * `idempotencyKey` é determinístico (`legacy-balance:<id>`), então rodar o
 * backfill mais de uma vez sobre o mesmo histórico não duplica nada: quem
 * chama esta função decide se já processou aquele id antes de inserir.
 */
export function deriveWalletTransactions(legacyRows: LegacyBalanceRow[]): {
  entries: DerivedWalletTransaction[];
  finalBalance: string;
} {
  const sorted = [...legacyRows].sort((a, b) => {
    const byDate = a.createdAt.getTime() - b.createdAt.getTime();
    return byDate !== 0 ? byDate : a.id - b.id;
  });

  let runningCents = 0;
  const entries = sorted.map((row) => {
    const magnitudeCents = toCents(row.value);
    runningCents += row.type === "sum" ? magnitudeCents : -magnitudeCents;

    return {
      idempotencyKey: `legacy-balance:${row.id}`,
      direction: row.type === "sum" ? ("credit" as const) : ("debit" as const),
      origin: mapOrigin(row),
      amount: fromCents(magnitudeCents),
      balanceAfter: fromCents(runningCents),
      referenceType: "legacy_balance",
      referenceId: row.referenceId,
      createdAt: row.createdAt,
    };
  });

  return { entries, finalBalance: fromCents(runningCents) };
}
