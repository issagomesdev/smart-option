import bcrypt from "bcryptjs";
import { SHA1 } from "crypto-js";

const BCRYPT_PREFIX = /^\$2[aby]?\$/;
const BCRYPT_COST = 12;

export function isBcryptHash(hash: string): boolean {
  return BCRYPT_PREFIX.test(hash);
}

export function hashPassword(plainPassword: string): Promise<string> {
  return bcrypt.hash(plainPassword, BCRYPT_COST);
}

/**
 * Aceita tanto o hash bcrypt novo quanto o SHA1 legado (sem salt) — usado
 * para autenticar sem exigir reset de senha em massa. Quem chama decide se
 * quer re-hashear com bcrypt ao detectar um match via SHA1 (ver
 * `AuthenticationService.verifyPassword`).
 */
export async function verifyPassword(storedHash: string, plainPassword: string): Promise<boolean> {
  if (isBcryptHash(storedHash)) {
    return bcrypt.compare(plainPassword, storedHash);
  }
  return storedHash === SHA1(plainPassword).toString();
}
