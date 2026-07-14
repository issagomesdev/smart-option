import { SHA1 } from "crypto-js";
import { describe, expect, it } from "vitest";
import { hashPassword, isBcryptHash, verifyPassword } from "./password";

describe("password", () => {
  it("hashPassword produz um hash bcrypt reconhecido por isBcryptHash", async () => {
    const hash = await hashPassword("minha-senha-forte");
    expect(isBcryptHash(hash)).toBe(true);
  });

  it("isBcryptHash rejeita um hash SHA1 legado", () => {
    expect(isBcryptHash(SHA1("qualquer-coisa").toString())).toBe(false);
  });

  it("verifyPassword aceita a senha certa contra um hash bcrypt", async () => {
    const hash = await hashPassword("senha-correta");
    await expect(verifyPassword(hash, "senha-correta")).resolves.toBe(true);
  });

  it("verifyPassword rejeita a senha errada contra um hash bcrypt", async () => {
    const hash = await hashPassword("senha-correta");
    await expect(verifyPassword(hash, "senha-errada")).resolves.toBe(false);
  });

  it("verifyPassword aceita o hash SHA1 legado (compatibilidade retroativa)", async () => {
    const legacyHash = SHA1("senha-antiga").toString();
    await expect(verifyPassword(legacyHash, "senha-antiga")).resolves.toBe(true);
  });

  it("verifyPassword rejeita senha errada contra hash SHA1 legado", async () => {
    const legacyHash = SHA1("senha-antiga").toString();
    await expect(verifyPassword(legacyHash, "senha-errada")).resolves.toBe(false);
  });
});
