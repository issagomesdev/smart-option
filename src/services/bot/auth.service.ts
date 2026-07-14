import { and, eq, isNull, ne, or } from "drizzle-orm";
import { db } from "../../infrastructure/database/client";
import { botUsers } from "../../infrastructure/database/schema";
import { UnauthorizedError, NotFoundError } from "../../shared/errors";
import { hashPassword, isBcryptHash, verifyPassword } from "../../shared/security/password";

export class AuthenticationService {
  static async login(email: string, password: string, userId: number) {
    const [user] = await db.select().from(botUsers).where(eq(botUsers.email, email));

    // Mensagem sempre genérica — não revela se o e-mail existe.
    if (!user) throw new UnauthorizedError("Email e/ou senha inválidos");

    const matches = await verifyPassword(user.password, password);
    if (!matches) throw new UnauthorizedError("Email e/ou senha inválidos");

    if (!isBcryptHash(user.password)) {
      await db.update(botUsers).set({ password: await hashPassword(password) }).where(eq(botUsers.id, user.id));
    }

    if (!user.verifiedEmailAt) throw new UnauthorizedError("Email não validado");
    if (!user.isActive) throw new UnauthorizedError("Acesso bloqueado, contate o suporte");

    await db
      .update(botUsers)
      .set({ telegramUserId: String(userId), lastActivity: new Date() })
      .where(eq(botUsers.id, user.id));

    return user;
  }

  static async isLoggedIn(userId: number) {
    const [user] = await db.select().from(botUsers).where(eq(botUsers.telegramUserId, String(userId)));

    if (user) {
      await db.update(botUsers).set({ lastActivity: new Date() }).where(eq(botUsers.id, user.id));
    }

    return user ?? null;
  }

  static async logout(userId: number): Promise<void> {
    await db.update(botUsers).set({ telegramUserId: null }).where(eq(botUsers.telegramUserId, String(userId)));
  }

  static async existingUser(email: string, telegramUserId: string) {
    const [user] = await db
      .select()
      .from(botUsers)
      .where(and(eq(botUsers.email, email), or(ne(botUsers.telegramUserId, telegramUserId), isNull(botUsers.telegramUserId))));

    if (!user) throw new NotFoundError("O e-mail fornecido não corresponde a nenhum usuário registrado em nossa base de dados");

    return user;
  }
}
