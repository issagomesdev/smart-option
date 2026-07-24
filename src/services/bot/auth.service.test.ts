import { SHA1 } from "crypto-js";
import { eq } from "drizzle-orm";
import { afterEach, describe, expect, it } from "vitest";
import { db } from "../../infrastructure/database/client";
import { botUsers } from "../../infrastructure/database/schema";
import { hashPassword, isBcryptHash } from "../../shared/security/password";
import { AuthenticationService } from "./auth.service";

/**
 * Login do bot do Telegram — porta de entrada para todo o lado financeiro
 * (saldo, saques, transferências), mesmo raciocínio de rigor de
 * `authentication.service.test.ts` (login do painel admin). Mesma migração
 * preguiçosa SHA1 → bcrypt do painel, aplicada aqui pela Fase 7.
 */
describe("AuthenticationService (bot, integração, banco real)", () => {
  const stamp = Date.now();
  const plainPassword = "Senha-Forte-123!";
  const createdIds: number[] = [];
  let counter = 0;

  afterEach(async () => {
    for (const id of createdIds) {
      await db.delete(botUsers).where(eq(botUsers.id, id));
    }
    createdIds.length = 0;
  });

  async function insertUser(overrides: Partial<typeof botUsers.$inferInsert> = {}) {
    counter += 1;
    const [user] = await db
      .insert(botUsers)
      .values({
        name: "Auth Bot Test",
        email: `auth-bot-test-${stamp}-${counter}@test.local`,
        password: await hashPassword(plainPassword),
        phoneNumber: "11900000000",
        adress: "Rua Teste, 1",
        pixCode: "chave-pix-teste",
        verifiedEmailAt: new Date(),
        isActive: true,
        ...overrides,
      })
      .$returningId();
    createdIds.push(user.id);
    return user.id;
  }

  describe("login", () => {
    it("credenciais corretas: devolve o usuário e vincula o telegramUserId/lastActivity", async () => {
      const userId = await insertUser();
      const telegramId = 900000000 + counter;

      const user = await AuthenticationService.login(`auth-bot-test-${stamp}-${counter}@test.local`, plainPassword, telegramId);

      expect(user.id).toBe(userId);

      const [updated] = await db.select().from(botUsers).where(eq(botUsers.id, userId));
      expect(updated.telegramUserId).toBe(String(telegramId));
      expect(updated.lastActivity).not.toBeNull();
    });

    it("hash SHA1 legado: autentica e migra a senha para bcrypt", async () => {
      const userId = await insertUser({ password: SHA1(plainPassword).toString() });
      const [before] = await db.select().from(botUsers).where(eq(botUsers.id, userId));
      expect(isBcryptHash(before.password)).toBe(false);

      const email = `auth-bot-test-${stamp}-${counter}@test.local`;
      const user = await AuthenticationService.login(email, plainPassword, 900000000 + counter);
      expect(user.id).toBe(userId);

      const [after] = await db.select().from(botUsers).where(eq(botUsers.id, userId));
      expect(isBcryptHash(after.password)).toBe(true);
    });

    it("e-mail inexistente lança a mesma mensagem genérica (sem enumeração de contas)", async () => {
      await expect(AuthenticationService.login("nao-existe-de-verdade@test.local", plainPassword, 1)).rejects.toThrow(
        "Email e/ou senha inválidos",
      );
    });

    it("senha incorreta lança a mesma mensagem genérica", async () => {
      await insertUser();
      await expect(
        AuthenticationService.login(`auth-bot-test-${stamp}-${counter}@test.local`, "senha-errada", 1),
      ).rejects.toThrow("Email e/ou senha inválidos");
    });

    it("e-mail não verificado (verifiedEmailAt nulo) recusa com mensagem específica", async () => {
      await insertUser({ verifiedEmailAt: null });
      await expect(AuthenticationService.login(`auth-bot-test-${stamp}-${counter}@test.local`, plainPassword, 1)).rejects.toThrow(
        "Email não validado",
      );
    });

    it("conta bloqueada (isActive=false) recusa com mensagem específica", async () => {
      await insertUser({ isActive: false });
      await expect(AuthenticationService.login(`auth-bot-test-${stamp}-${counter}@test.local`, plainPassword, 1)).rejects.toThrow(
        "Acesso bloqueado, contate o suporte",
      );
    });
  });

  describe("isLoggedIn", () => {
    it("devolve o usuário e atualiza lastActivity quando o telegramUserId está vinculado", async () => {
      const telegramId = 900000000 + counter + 1;
      const userId = await insertUser({ telegramUserId: String(telegramId) });

      const user = await AuthenticationService.isLoggedIn(telegramId);

      expect(user?.id).toBe(userId);
    });

    it("devolve null quando nenhum usuário tem esse telegramUserId", async () => {
      const user = await AuthenticationService.isLoggedIn(999999999);
      expect(user).toBeNull();
    });
  });

  describe("logout", () => {
    it("desvincula o telegramUserId do usuário", async () => {
      const telegramId = 900000000 + counter + 2;
      const userId = await insertUser({ telegramUserId: String(telegramId) });

      await AuthenticationService.logout(telegramId);

      const [after] = await db.select().from(botUsers).where(eq(botUsers.id, userId));
      expect(after.telegramUserId).toBeNull();
    });
  });

  describe("existingUser", () => {
    it("encontra um usuário pelo e-mail cujo telegramUserId é diferente do informado", async () => {
      const userId = await insertUser({ telegramUserId: String(900000000 + counter + 3) });
      const email = `auth-bot-test-${stamp}-${counter}@test.local`;

      const user = await AuthenticationService.existingUser(email, "outro-telegram-id");
      expect(user.id).toBe(userId);
    });

    it("encontra um usuário pelo e-mail sem telegramUserId vinculado (nunca logou)", async () => {
      const userId = await insertUser({ telegramUserId: null });
      const email = `auth-bot-test-${stamp}-${counter}@test.local`;

      const user = await AuthenticationService.existingUser(email, "qualquer-id");
      expect(user.id).toBe(userId);
    });

    it("lança NotFoundError quando o e-mail não corresponde a ninguém", async () => {
      await expect(AuthenticationService.existingUser("nao-existe-de-verdade@test.local", "id-qualquer")).rejects.toThrow(
        "O e-mail fornecido não corresponde a nenhum usuário registrado em nossa base de dados",
      );
    });
  });
});
