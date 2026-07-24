import { eq } from "drizzle-orm";
import jwt from "jsonwebtoken";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const sendEmailVerification = vi.fn();
vi.mock("../../notifications/services/notification.service", () => ({
  notificationService: { sendEmailVerification: (...args: unknown[]) => sendEmailVerification(...args) },
}));

import { db } from "../../infrastructure/database/client";
import { botUsers, emailVerifications, userPlans, walletTransactions, wallets } from "../../infrastructure/database/schema";
import { env } from "../../config/env";
import { RegisterService } from "./register.service";

// Mesmo CPF válido (dígito verificador correto) já usado em `e2e/users.spec.ts`.
const VALID_CPF = "52998224725";

describe("RegisterService (bot, integração, banco real)", () => {
  const stamp = Date.now();
  const createdUserIds: number[] = [];
  let counter = 0;

  beforeEach(() => {
    sendEmailVerification.mockReset();
    sendEmailVerification.mockResolvedValue(undefined);
  });

  afterEach(async () => {
    for (const id of createdUserIds) {
      await db.delete(emailVerifications).where(eq(emailVerifications.userId, id));
      await db.delete(userPlans).where(eq(userPlans.userId, id));
      // `wallet_transactions` referencia `wallet.id` — precisa sair primeiro.
      await db.delete(walletTransactions).where(eq(walletTransactions.userId, id));
      await db.delete(wallets).where(eq(wallets.userId, id));
      await db.delete(botUsers).where(eq(botUsers.id, id));
    }
    createdUserIds.length = 0;
  });

  function uniqueEmail() {
    counter += 1;
    return `register-bot-test-${stamp}-${counter}@test.local`;
  }

  describe("registerUser", () => {
    it("cria o usuário, dispara o e-mail de verificação e devolve sucesso", async () => {
      const email = uniqueEmail();
      const result = await RegisterService.registerUser({
        name: "Novo Usuário",
        email,
        password: "senha-forte-123",
        phone_number: "11900000000",
        cpf: VALID_CPF,
        adress: "Rua Teste, 1",
        pix_code: email,
      });

      expect(result).toEqual({ status: true, message: "Usuário cadastrado com sucesso" });

      const [user] = await db.select().from(botUsers).where(eq(botUsers.email, email));
      expect(user).toBeDefined();
      createdUserIds.push(user.id);
      expect(user.cpf).toBe(VALID_CPF);
      expect(sendEmailVerification).toHaveBeenCalledWith(expect.objectContaining({ to: email }));
    });

    it("recusa e-mail já em uso", async () => {
      const email = uniqueEmail();
      const first = await db
        .insert(botUsers)
        .values({ name: "X", email, password: "x", phoneNumber: "1", adress: "1", pixCode: "1" })
        .$returningId();
      createdUserIds.push(first[0].id);

      await expect(
        RegisterService.registerUser({
          name: "Y",
          email,
          password: "senha-forte-123",
          phone_number: "11900000000",
          cpf: VALID_CPF,
          adress: "Rua Teste, 1",
          pix_code: "x",
        }),
      ).rejects.toThrow("Email já em uso");
    });

    it("recusa CPF inválido (dígito verificador incorreto)", async () => {
      await expect(
        RegisterService.registerUser({
          name: "Z",
          email: uniqueEmail(),
          password: "senha-forte-123",
          phone_number: "11900000000",
          cpf: "11111111111",
          adress: "Rua Teste, 1",
          pix_code: "x",
        }),
      ).rejects.toThrow("CPF inválido");
    });

    it("com balance+type='sum', credita o valor na wallet do novo usuário", async () => {
      const email = uniqueEmail();
      await RegisterService.registerUser({
        name: "Com Saldo",
        email,
        password: "senha-forte-123",
        phone_number: "11900000000",
        cpf: VALID_CPF,
        adress: "Rua Teste, 1",
        pix_code: email,
        balance: "150.00",
        type: "sum",
      });

      const [user] = await db.select().from(botUsers).where(eq(botUsers.email, email));
      createdUserIds.push(user.id);

      const [wallet] = await db.select().from(wallets).where(eq(wallets.userId, user.id));
      expect(Number(wallet.balance)).toBe(150);
    });

    it("com product_id, matricula o usuário no plano", async () => {
      const email = uniqueEmail();
      await RegisterService.registerUser({
        name: "Com Plano",
        email,
        password: "senha-forte-123",
        phone_number: "11900000000",
        cpf: VALID_CPF,
        adress: "Rua Teste, 1",
        pix_code: email,
        product_id: 1,
      });

      const [user] = await db.select().from(botUsers).where(eq(botUsers.email, email));
      createdUserIds.push(user.id);

      const [plan] = await db.select().from(userPlans).where(eq(userPlans.userId, user.id));
      expect(plan).toMatchObject({ productId: 1 });
    });

    it("não derruba o cadastro se o envio do e-mail de verificação falhar (best-effort)", async () => {
      sendEmailVerification.mockRejectedValue(new Error("provedor de e-mail fora do ar"));
      const email = uniqueEmail();

      const result = await RegisterService.registerUser({
        name: "Falha No E-mail",
        email,
        password: "senha-forte-123",
        phone_number: "11900000000",
        cpf: VALID_CPF,
        adress: "Rua Teste, 1",
        pix_code: email,
      });

      expect(result.status).toBe(true);
      const [user] = await db.select().from(botUsers).where(eq(botUsers.email, email));
      createdUserIds.push(user.id);
    });
  });

  describe("verificationEmail", () => {
    async function registerAndGetToken() {
      const email = uniqueEmail();
      await RegisterService.registerUser({
        name: "Verificação",
        email,
        password: "senha-forte-123",
        phone_number: "11900000000",
        cpf: VALID_CPF,
        adress: "Rua Teste, 1",
        pix_code: email,
      });

      const [user] = await db.select().from(botUsers).where(eq(botUsers.email, email));
      createdUserIds.push(user.id);

      const [verification] = await db.select().from(emailVerifications).where(eq(emailVerifications.userId, user.id));
      return { userId: user.id, token: verification.token };
    }

    it("token válido: marca o e-mail como verificado e o registro de verificação como 'checked'", async () => {
      const { userId, token } = await registerAndGetToken();

      await RegisterService.verificationEmail(token);

      const [user] = await db.select().from(botUsers).where(eq(botUsers.id, userId));
      expect(user.verifiedEmailAt).not.toBeNull();

      const [verification] = await db.select().from(emailVerifications).where(eq(emailVerifications.userId, userId));
      expect(verification.status).toBe("checked");
    });

    it("token ausente lança ValidationError com mensagem específica", async () => {
      await expect(RegisterService.verificationEmail("")).rejects.toThrow("Token ausente");
    });

    it("token malformado/inválido lança 'Token inválido' em vez de estourar sem tratamento", async () => {
      await expect(RegisterService.verificationEmail("isso-nao-e-um-jwt")).rejects.toThrow("Token inválido");
    });

    it("token expirado lança a mensagem amigável em vez de estourar sem tratamento (bug real corrigido nesta fase)", async () => {
      // `jwt.verify` já lança `TokenExpiredError` antes de qualquer consulta
      // ao banco — não precisa de uma linha real em `emailVerifications`
      // para provar este caminho, o erro nunca chega lá.
      const expiredToken = jwt.sign({ email: "x" }, env.SECRET_KEY, { expiresIn: "-1s" });

      await expect(RegisterService.verificationEmail(expiredToken)).rejects.toThrow(
        "Token inválido ou expirado! Realize o login para solicitar um novo email de confirmação",
      );
    });

    it("token já validado antes: marca como 'checked' de novo e lança ConflictError", async () => {
      const { userId, token } = await registerAndGetToken();
      await RegisterService.verificationEmail(token);

      await expect(RegisterService.verificationEmail(token)).rejects.toThrow("Email já validado");

      const [verification] = await db.select().from(emailVerifications).where(eq(emailVerifications.userId, userId));
      expect(verification.status).toBe("checked");
    });
  });
});
