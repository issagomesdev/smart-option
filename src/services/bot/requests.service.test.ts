import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "../../infrastructure/database/client";
import { botUsers, supportRequests } from "../../infrastructure/database/schema";
import { RequestsService } from "./requests.service";

describe("RequestsService (bot, integração, banco real)", () => {
  const stamp = Date.now();
  const telegramUserId = 900000000 + Number(String(stamp).slice(-6));
  let userId: number;

  beforeAll(async () => {
    const [user] = await db
      .insert(botUsers)
      .values({
        name: "Requests Bot Test",
        email: `requests-bot-test-${stamp}@test.local`,
        password: "x",
        phoneNumber: "11900000000",
        adress: "Rua Teste, 1",
        pixCode: "chave-pix-teste",
        telegramUserId: String(telegramUserId),
      })
      .$returningId();
    userId = user.id;
  });

  afterAll(async () => {
    await db.delete(supportRequests).where(eq(supportRequests.userId, userId));
    await db.delete(botUsers).where(eq(botUsers.id, userId));
  });

  it("cria um ticket de suporte vinculado ao usuário logado (por telegramUserId)", async () => {
    await RequestsService.request("support", telegramUserId, "Não consigo sacar");

    const [row] = await db.select().from(supportRequests).where(eq(supportRequests.userId, userId));
    expect(row).toMatchObject({ type: "support", subject: "Não consigo sacar", telegramUserId, isRead: 0 });
  });

  it("cria um ticket de adesão de serviço (type='service')", async () => {
    await RequestsService.request("service", telegramUserId, "Quero contratar a alavancagem");

    const [row] = await db
      .select()
      .from(supportRequests)
      .where(eq(supportRequests.subject, "Quero contratar a alavancagem"));
    expect(row).toMatchObject({ type: "service", userId });
  });

  it("lança NotFoundError quando o telegramUserId não corresponde a nenhum usuário logado", async () => {
    await expect(RequestsService.request("support", 999999999, "assunto")).rejects.toThrow("Usuário não encontrado");
  });
});
