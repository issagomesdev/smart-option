import { SHA1 } from "crypto-js";
import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "../infrastructure/database/client";
import { staffRefreshTokens, staffUsers } from "../infrastructure/database/schema";
import { hashPassword, isBcryptHash } from "../shared/security/password";
import { AuthenticationService } from "./authentication.service";

/**
 * Testes de integração contra o banco real — login/refresh/rotação de token
 * são a porta de entrada de todo o painel admin, então valem uma prova
 * contra o banco de verdade, não contra um mock que esconderia um erro de
 * query (o mesmo raciocínio do WalletService).
 */
describe("AuthenticationService (integração, banco real)", () => {
  let bcryptUserId: number;
  let legacyUserId: number;
  const plainPassword = "Senha-Forte-123!";

  beforeAll(async () => {
    const stamp = Date.now();
    const [bcryptUser] = await db
      .insert(staffUsers)
      .values({
        name: "Auth Test",
        surname: "Bcrypt",
        email: `auth-test-bcrypt-${stamp}@test.local`,
        password: await hashPassword(plainPassword),
      })
      .$returningId();
    const [legacyUser] = await db
      .insert(staffUsers)
      .values({
        name: "Auth Test",
        surname: "Legacy",
        email: `auth-test-legacy-${stamp}@test.local`,
        password: SHA1(plainPassword).toString(),
      })
      .$returningId();
    bcryptUserId = bcryptUser.id;
    legacyUserId = legacyUser.id;
  });

  afterAll(async () => {
    const ids = [bcryptUserId, legacyUserId];
    await db.delete(staffRefreshTokens).where(inArray(staffRefreshTokens.staffUserId, ids));
    await db.delete(staffUsers).where(inArray(staffUsers.id, ids));
  });

  it("login com credenciais corretas emite tokens e dados do usuário", async () => {
    const [user] = await db.select().from(staffUsers).where(eq(staffUsers.id, bcryptUserId));
    const result = await AuthenticationService.login(user.email, plainPassword);

    expect(result.auth).toBe(true);
    expect(result.accessToken).toEqual(expect.any(String));
    expect(result.refreshToken).toEqual(expect.any(String));
    expect(result.user).toMatchObject({ id: bcryptUserId, email: user.email });
  });

  it("login devolve permissions do papel atual (role_id=2 'staff', seed sem nenhuma permissão)", async () => {
    const [user] = await db.select().from(staffUsers).where(eq(staffUsers.id, bcryptUserId));
    const result = await AuthenticationService.login(user.email, plainPassword);

    expect(result.user.permissions).toEqual([]);
  });

  it("login com conta desativada (deletedAt setado) lança a mesma mensagem genérica, sem emitir token", async () => {
    const stamp = Date.now();
    const [deactivated] = await db
      .insert(staffUsers)
      .values({
        name: "Auth Test",
        surname: "Deactivated",
        email: `auth-test-deactivated-${stamp}@test.local`,
        password: await hashPassword(plainPassword),
        deletedAt: new Date(),
      })
      .$returningId();

    try {
      await expect(AuthenticationService.login(`auth-test-deactivated-${stamp}@test.local`, plainPassword)).rejects.toThrow(
        "Email e/ou senha inválidos",
      );
    } finally {
      await db.delete(staffUsers).where(eq(staffUsers.id, deactivated.id));
    }
  });

  it("login com senha incorreta lança erro genérico", async () => {
    const [user] = await db.select().from(staffUsers).where(eq(staffUsers.id, bcryptUserId));
    await expect(AuthenticationService.login(user.email, "senha-errada")).rejects.toThrow("Email e/ou senha inválidos");
  });

  it("login com e-mail inexistente lança a mesma mensagem genérica (sem enumeração de contas)", async () => {
    await expect(AuthenticationService.login("nao-existe-de-verdade@test.local", plainPassword)).rejects.toThrow(
      "Email e/ou senha inválidos",
    );
  });

  it("login com hash SHA1 legado autentica e migra a senha para bcrypt", async () => {
    const [userBefore] = await db.select().from(staffUsers).where(eq(staffUsers.id, legacyUserId));
    expect(isBcryptHash(userBefore.password)).toBe(false);

    const result = await AuthenticationService.login(userBefore.email, plainPassword);
    expect(result.auth).toBe(true);

    const [userAfter] = await db.select().from(staffUsers).where(eq(staffUsers.id, legacyUserId));
    expect(isBcryptHash(userAfter.password)).toBe(true);

    // A senha continua funcionando, agora via bcrypt.
    const secondLogin = await AuthenticationService.login(userBefore.email, plainPassword);
    expect(secondLogin.auth).toBe(true);
  });

  it("refresh rotaciona o token: emite um par novo e o novo refresh token também funciona em seguida", async () => {
    const [user] = await db.select().from(staffUsers).where(eq(staffUsers.id, bcryptUserId));
    const { refreshToken: firstToken } = await AuthenticationService.login(user.email, plainPassword);

    const { refreshToken: secondToken } = await AuthenticationService.refresh(firstToken);
    expect(secondToken).not.toBe(firstToken);

    // O token novo (ainda não usado) continua válido para uma próxima rotação.
    const { refreshToken: thirdToken } = await AuthenticationService.refresh(secondToken);
    expect(thirdToken).not.toBe(secondToken);
  });

  it("reusar um refresh token já revogado derruba toda a família de tokens (defesa contra roubo)", async () => {
    const [user] = await db.select().from(staffUsers).where(eq(staffUsers.id, bcryptUserId));
    const { refreshToken: tokenA } = await AuthenticationService.login(user.email, plainPassword);
    const { refreshToken: tokenB } = await AuthenticationService.refresh(tokenA);

    // tokenA já foi consumido/rotacionado; um atacante que o tivesse roubado
    // tentaria reutilizá-lo agora — isso deve derrubar a família inteira,
    // inclusive o tokenB legítimo que ainda não tinha sido usado.
    await expect(AuthenticationService.refresh(tokenA)).rejects.toThrow("Refresh token inválido");
    await expect(AuthenticationService.refresh(tokenB)).rejects.toThrow("Refresh token inválido");
  });

  it("logout revoga o refresh token, impedindo reuso", async () => {
    const [user] = await db.select().from(staffUsers).where(eq(staffUsers.id, bcryptUserId));
    const { refreshToken } = await AuthenticationService.login(user.email, plainPassword);

    await AuthenticationService.logout(refreshToken);

    await expect(AuthenticationService.refresh(refreshToken)).rejects.toThrow();
  });
});
