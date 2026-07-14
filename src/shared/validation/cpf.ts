/**
 * Validação de CPF pelo algoritmo padrão de dígito verificador (mod 11).
 * Aceita tanto dígitos crus quanto formatado (123.456.789-00) — quem chama
 * decide se quer normalizar antes de armazenar.
 */
export function isValidCpf(value: string): boolean {
  const digits = value.replace(/\D/g, "");
  if (digits.length !== 11 || /^(\d)\1{10}$/.test(digits)) return false;

  const calcCheckDigit = (length: number): number => {
    let sum = 0;
    for (let i = 0; i < length; i++) {
      sum += Number(digits[i]) * (length + 1 - i);
    }
    const remainder = (sum * 10) % 11;
    return remainder === 10 ? 0 : remainder;
  };

  return calcCheckDigit(9) === Number(digits[9]) && calcCheckDigit(10) === Number(digits[10]);
}

export function normalizeCpf(value: string): string {
  return value.replace(/\D/g, "");
}
