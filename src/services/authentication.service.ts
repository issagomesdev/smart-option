import { randomBytes, createHash } from "node:crypto";
import jwt from "jsonwebtoken";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "../infrastructure/database/client";
import { roles, staffRefreshTokens, staffUsers } from "../infrastructure/database/schema";
import { env } from "../config/env";
import { assertDemoEnabled } from "../config/demo";
import { UnauthorizedError } from "../shared/errors";
import { logger } from "../shared/logger";
import type { Permission } from "../shared/permissions/permissions";
import { hashPassword, isBcryptHash, verifyPassword } from "../shared/security/password";

const SESSION_REFRESH_TTL_MS = 24 * 60 * 60 * 1000;
const REMEMBER_REFRESH_TTL_MS = parseDurationToMs(env.JWT_REFRESH_EXPIRES_IN, 30 * 24 * 60 * 60 * 1000);

/** Conta compartilhada por todos os visitantes da demonstração. `.local` nunca resolve como domínio real. */
const DEMO_STAFF_EMAIL = "visitante@demo.local";
/** Papel `admin` semeado — a demonstração mostra o painel inteiro; a contenção é `denyInDemo()`. */
const DEMO_STAFF_ROLE_ID = 1;

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthenticatedStaffUser {
  id: number;
  name: string;
  surname: string;
  email: string;
  roleId: number;
  permissions: Permission[];
}

function parseDurationToMs(value: string, fallback: number): number {
  const match = /^(\d+)([smhd])$/.exec(value.trim());
  if (!match) return fallback;
  const amount = Number(match[1]);
  const unit = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 }[match[2]];
  return unit ? amount * unit : fallback;
}

function hashToken(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex");
}

function signAccessToken(userId: number): string {
  return jwt.sign({ userId }, env.SECRET_KEY, { expiresIn: env.JWT_ACCESS_EXPIRES_IN } as jwt.SignOptions);
}

export class AuthenticationService {
  /**
   * Aceita o hash SHA1 legado (sem salt) além do bcrypt novo. Ao autenticar
   * com sucesso via SHA1, re-hasheia a senha com bcrypt e atualiza o
   * registro na hora — "lazy migration": não exige reset de senha em massa,
   * cada usuário migra no próximo login.
   */
  private static async verifyAndUpgradePassword(userId: number, storedHash: string, plainPassword: string): Promise<boolean> {
    const matches = await verifyPassword(storedHash, plainPassword);
    if (!matches) return false;

    if (!isBcryptHash(storedHash)) {
      const upgradedHash = await hashPassword(plainPassword);
      await db.update(staffUsers).set({ password: upgradedHash }).where(eq(staffUsers.id, userId));
      logger.info({ userId }, "Senha migrada de SHA1 para bcrypt no login");
    }

    return true;
  }

  private static async issueTokens(userId: number, remember: boolean): Promise<AuthTokens> {
    const accessToken = signAccessToken(userId);

    const refreshToken = randomBytes(48).toString("hex");
    const ttlMs = remember ? REMEMBER_REFRESH_TTL_MS : SESSION_REFRESH_TTL_MS;

    await db.insert(staffRefreshTokens).values({
      staffUserId: userId,
      tokenHash: hashToken(refreshToken),
      expiresAt: new Date(Date.now() + ttlMs),
    });

    return { accessToken, refreshToken };
  }

  /**
   * Sessão de visitante do modo demonstração (`POST /api/auth/demo-login`) — sem e-mail, sem senha,
   * sem credencial pública para divulgar.
   *
   * Por que existe uma linha real em `staff_users` em vez de um token sintético: o access token
   * carrega apenas `{ userId }` e `authenticateToken` (`server/middlewares/auth.interceptor.ts`)
   * refaz um INNER JOIN `staff_users` + `roles` a cada requisição. Um usuário inventado não
   * sobreviveria a esse join — toda chamada autenticada daria 401. O upsert abaixo é idempotente,
   * então todos os visitantes compartilham a mesma conta demo, e ela é preservada pelo
   * `demo:reset` (que não trunca `staff_users`).
   *
   * O visitante recebe o papel `admin` de propósito: a demonstração precisa mostrar o produto
   * inteiro. A contenção não vem de permissões reduzidas, e sim de `denyInDemo()` nas rotas
   * irreversíveis — decisão registrada em `config/demo.ts`.
   */
  static async demoLogin(): Promise<{ auth: true } & AuthTokens & { user: AuthenticatedStaffUser }> {
    assertDemoEnabled("auth/demo-login");

    const [existing] = await db
      .select({ id: staffUsers.id })
      .from(staffUsers)
      .where(eq(staffUsers.email, DEMO_STAFF_EMAIL));

    let userId = existing?.id;

    if (!userId) {
      // Senha aleatória e descartada: esta conta nunca deve autenticar pelo login normal, só por
      // esta rota. Gravar um hash de valor desconhecido é o que garante isso.
      const unusablePassword = await hashPassword(randomBytes(32).toString("hex"));
      const [created] = await db
        .insert(staffUsers)
        .values({
          name: "Visitante",
          surname: "Demonstração",
          email: DEMO_STAFF_EMAIL,
          password: unusablePassword,
          roleId: DEMO_STAFF_ROLE_ID,
        })
        .$returningId();
      userId = created.id;
      logger.info({ userId }, "Conta de visitante da demonstração criada");
    } else {
      // Reativa (soft-delete) e reafirma o papel, caso alguém tenha mexido durante a demonstração.
      await db
        .update(staffUsers)
        .set({ deletedAt: null, roleId: DEMO_STAFF_ROLE_ID })
        .where(eq(staffUsers.id, userId));
    }

    const [user] = await db
      .select({
        id: staffUsers.id,
        name: staffUsers.name,
        surname: staffUsers.surname,
        email: staffUsers.email,
        roleId: staffUsers.roleId,
        permissions: roles.permissions,
      })
      .from(staffUsers)
      .innerJoin(roles, eq(staffUsers.roleId, roles.id))
      .where(eq(staffUsers.id, userId));

    const tokens = await AuthenticationService.issueTokens(user.id, false);

    return {
      auth: true,
      ...tokens,
      user: {
        id: user.id,
        name: user.name,
        surname: user.surname,
        email: user.email,
        roleId: user.roleId,
        permissions: user.permissions ?? [],
      },
    };
  }

  static async login(email: string, password: string, remember = false): Promise<{ auth: true } & AuthTokens & { user: AuthenticatedStaffUser }> {
    // Mensagem sempre genérica (não revela se o e-mail existe, nem se a conta
    // existe mas está desativada) — evita enumeração de contas.
    const invalidCredentials = () => new UnauthorizedError("Email e/ou senha inválidos");

    // `deletedAt IS NULL`: staff desativado (soft-delete, Fase 5) não
    // consegue mais logar — sem este filtro, uma conta desativada ainda
    // emitiria tokens válidos aqui e só seria barrada na próxima requisição
    // autenticada (`authenticateToken` já filtra), UX confusa e emissão de
    // token desnecessária para uma conta que não deveria ter acesso.
    const [user] = await db
      .select({
        id: staffUsers.id,
        name: staffUsers.name,
        surname: staffUsers.surname,
        email: staffUsers.email,
        password: staffUsers.password,
        roleId: staffUsers.roleId,
        permissions: roles.permissions,
      })
      .from(staffUsers)
      .innerJoin(roles, eq(staffUsers.roleId, roles.id))
      .where(and(eq(staffUsers.email, email), isNull(staffUsers.deletedAt)));

    if (!user) throw invalidCredentials();

    const passwordMatches = await AuthenticationService.verifyAndUpgradePassword(user.id, user.password, password);
    if (!passwordMatches) throw invalidCredentials();

    const tokens = await AuthenticationService.issueTokens(user.id, remember);

    return {
      auth: true,
      ...tokens,
      user: {
        id: user.id,
        name: user.name,
        surname: user.surname,
        email: user.email,
        roleId: user.roleId,
        permissions: user.permissions ?? [],
      },
    };
  }

  /**
   * Rotação de refresh token: cada uso revoga o token apresentado e emite um
   * par novo. Se o token apresentado já estiver revogado, é sinal de que um
   * token antigo vazou e está sendo reutilizado — revoga toda a família de
   * tokens do usuário como resposta defensiva.
   */
  static async refresh(rawRefreshToken: string): Promise<AuthTokens> {
    const tokenHash = hashToken(rawRefreshToken);
    const [stored] = await db.select().from(staffRefreshTokens).where(eq(staffRefreshTokens.tokenHash, tokenHash));

    if (!stored) throw new UnauthorizedError("Refresh token inválido");

    if (stored.revokedAt) {
      await db
        .update(staffRefreshTokens)
        .set({ revokedAt: new Date() })
        .where(and(eq(staffRefreshTokens.staffUserId, stored.staffUserId), isNull(staffRefreshTokens.revokedAt)));
      logger.warn({ staffUserId: stored.staffUserId }, "Reuso de refresh token revogado detectado — família de tokens revogada");
      throw new UnauthorizedError("Refresh token inválido");
    }

    if (stored.expiresAt.getTime() < Date.now()) {
      throw new UnauthorizedError("Refresh token expirado");
    }

    await db.update(staffRefreshTokens).set({ revokedAt: new Date() }).where(eq(staffRefreshTokens.id, stored.id));

    const remember = stored.expiresAt.getTime() - stored.createdAt.getTime() > SESSION_REFRESH_TTL_MS;
    return AuthenticationService.issueTokens(stored.staffUserId, remember);
  }

  static async logout(rawRefreshToken: string): Promise<void> {
    const tokenHash = hashToken(rawRefreshToken);
    await db
      .update(staffRefreshTokens)
      .set({ revokedAt: new Date() })
      .where(and(eq(staffRefreshTokens.tokenHash, tokenHash), isNull(staffRefreshTokens.revokedAt)));
  }
}
