import { PixKeyType } from "../../interfaces/payment-provider";
import { isValidCpf } from "../../../shared/validation/cpf";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const EVP_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A Asaas exige o tipo da chave PIX; o cadastro do bot só guarda a chave crua. */
export function inferPixKeyType(pixKey: string): PixKeyType {
  const digitsOnly = pixKey.replace(/\D/g, "");

  if (EMAIL_REGEX.test(pixKey)) return "EMAIL";
  if (EVP_REGEX.test(pixKey)) return "EVP";
  if (digitsOnly.length === 14) return "CNPJ";
  // CPF e telefone celular (DDD + 9 dígitos) têm o mesmo tamanho — só o
  // dígito verificador do CPF (mod 11) distingue os dois com confiança.
  if (digitsOnly.length === 11 && isValidCpf(digitsOnly)) return "CPF";
  if (digitsOnly.length >= 10 && digitsOnly.length <= 13) return "PHONE";

  throw new Error(`Não foi possível identificar o tipo da chave PIX: ${pixKey}`);
}
