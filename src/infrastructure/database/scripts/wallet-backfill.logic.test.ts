import { describe, expect, it } from "vitest";
import { deriveWalletTransactions, LegacyBalanceRow } from "./wallet-backfill.logic";

function row(partial: Partial<LegacyBalanceRow> & Pick<LegacyBalanceRow, "id" | "value" | "type" | "origin">): LegacyBalanceRow {
  return {
    referenceId: null,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    ...partial,
  };
}

describe("deriveWalletTransactions", () => {
  it("calcula o saldo corrente em ordem cronológica, não por ordem de id", () => {
    const rows: LegacyBalanceRow[] = [
      row({ id: 2, value: "50.00", type: "sum", origin: "earnings", createdAt: new Date("2026-01-02") }),
      row({ id: 1, value: "100.00", type: "sum", origin: "deposit", createdAt: new Date("2026-01-01") }),
    ];

    const { entries, finalBalance } = deriveWalletTransactions(rows);

    expect(entries.map((e) => e.idempotencyKey)).toEqual(["legacy-balance:1", "legacy-balance:2"]);
    expect(entries[0].balanceAfter).toBe("100.00");
    expect(entries[1].balanceAfter).toBe("150.00");
    expect(finalBalance).toBe("150.00");
  });

  it("mapeia origin='transfer' para transfer_in/transfer_out conforme o type", () => {
    const rows: LegacyBalanceRow[] = [
      row({ id: 1, value: "20.00", type: "sum", origin: "transfer" }),
      row({ id: 2, value: "5.00", type: "subtract", origin: "transfer" }),
    ];

    const { entries } = deriveWalletTransactions(rows);

    expect(entries[0].origin).toBe("transfer_in");
    expect(entries[0].direction).toBe("credit");
    expect(entries[1].origin).toBe("transfer_out");
    expect(entries[1].direction).toBe("debit");
  });

  it("mapeia origin='admin' para admin_adjustment", () => {
    const rows: LegacyBalanceRow[] = [row({ id: 1, value: "10.00", type: "sum", origin: "admin" })];

    const { entries } = deriveWalletTransactions(rows);

    expect(entries[0].origin).toBe("admin_adjustment");
  });

  it("preserva demais origins 1:1", () => {
    const origins: LegacyBalanceRow["origin"][] = [
      "deposit",
      "withdrawal",
      "earnings",
      "profitability",
      "subscription",
      "tuition",
      "diamond_tax",
    ];
    const rows: LegacyBalanceRow[] = origins.map((origin, index) =>
      row({ id: index + 1, value: "1.00", type: "sum", origin }),
    );

    const { entries } = deriveWalletTransactions(rows);

    expect(entries.map((e) => e.origin)).toEqual(origins);
  });

  it("não perde precisão decimal em somas sucessivas (evita erro de ponto flutuante)", () => {
    const rows: LegacyBalanceRow[] = [
      row({ id: 1, value: "0.10", type: "sum", origin: "deposit" }),
      row({ id: 2, value: "0.20", type: "sum", origin: "deposit" }),
    ];

    const { finalBalance } = deriveWalletTransactions(rows);

    expect(finalBalance).toBe("0.30");
  });

  it("retorna saldo zerado para histórico vazio", () => {
    const { entries, finalBalance } = deriveWalletTransactions([]);

    expect(entries).toEqual([]);
    expect(finalBalance).toBe("0.00");
  });

  it("é determinístico: idempotencyKey depende só do id legado", () => {
    const rows: LegacyBalanceRow[] = [row({ id: 42, value: "7.00", type: "sum", origin: "deposit" })];

    const first = deriveWalletTransactions(rows);
    const second = deriveWalletTransactions(rows);

    expect(first.entries[0].idempotencyKey).toBe(second.entries[0].idempotencyKey);
    expect(first.entries[0].idempotencyKey).toBe("legacy-balance:42");
  });
});
