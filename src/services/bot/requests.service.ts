import { eq } from "drizzle-orm";
import { db } from "../../infrastructure/database/client";
import { botUsers, supportRequests } from "../../infrastructure/database/schema";
import { NotFoundError } from "../../shared/errors";

export class RequestsService {
  static async request(type: "support" | "service", telegramUserId: number, subject: string) {
    const [user] = await db.select({ id: botUsers.id }).from(botUsers).where(eq(botUsers.telegramUserId, String(telegramUserId)));
    if (!user) throw new NotFoundError("Usuário não encontrado");

    await db.insert(supportRequests).values({
      type,
      userId: user.id,
      telegramUserId,
      subject,
    });
  }
}
