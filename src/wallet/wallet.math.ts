/**
 * Aritmética monetária em centavos (inteiros) para evitar erro de ponto
 * flutuante em somas/subtrações sucessivas — o mesmo problema que o backfill
 * da Fase 2 já teve que resolver (`wallet-backfill.logic.ts`).
 */
export function toCents(decimalValue: string | number): number {
  return Math.round(Number(decimalValue) * 100);
}

export function fromCents(cents: number): string {
  return (cents / 100).toFixed(2);
}

export function applyDirection(currentCents: number, amountCents: number, direction: "credit" | "debit"): number {
  return direction === "credit" ? currentCents + amountCents : currentCents - amountCents;
}
