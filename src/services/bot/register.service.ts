import { eq } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import * as jwt from 'jsonwebtoken';
import moment from 'moment';
import { db } from "../../infrastructure/database/client";
import { botUsers, userPlans, emailVerifications } from "../../infrastructure/database/schema";
import { walletService } from "../../wallet/wallet.service";
import { ConflictError, ValidationError } from "../../shared/errors";
import { env } from "../../config/env";
import { hashPassword } from "../../shared/security/password";
import { isValidCpf, normalizeCpf } from "../../shared/validation/cpf";
import { NetworkService } from "./network.service";
import { logger } from "../../shared/logger";
import { notificationService } from "../../notifications/services/notification.service";

export interface RegisterUserInput {
  name: string;
  email: string;
  password: string;
  phone_number: string;
  cpf: string;
  adress: string;
  pix_code: string;
  balance?: string;
  type?: "sum" | "subtract";
  product_id?: number;
}

export class RegisterService {
  static async registerUser(body: RegisterUserInput, affiliateId: number | null = null) {
    const [existing] = await db.select({ id: botUsers.id }).from(botUsers).where(eq(botUsers.email, body.email));
    if (existing) throw new ConflictError("Email já em uso");

    if (!isValidCpf(body.cpf)) throw new ValidationError("CPF inválido");

    const [inserted] = await db
      .insert(botUsers)
      .values({
        name: body.name,
        email: body.email,
        password: await hashPassword(body.password),
        phoneNumber: body.phone_number,
        cpf: normalizeCpf(body.cpf),
        adress: body.adress,
        pixCode: body.pix_code,
      })
      .$returningId();

    if (body.balance && body.type) {
      await walletService[body.type === "sum" ? "credit" : "debit"]({
        userId: inserted.id,
        amount: parseFloat(body.balance),
        origin: "admin_adjustment",
        idempotencyKey: uuidv4(),
      });
    }

    if (body.product_id) {
      await db.insert(userPlans).values({
        userId: inserted.id,
        productId: body.product_id,
        expiredIn: moment().add(1, "months").toDate(),
      });
    }

    if (affiliateId) await NetworkService.upNetwork(affiliateId, inserted.id);
    await RegisterService.sendVerificationEmail(body.email);

    return { status: true, message: "Usuário cadastrado com sucesso" };
  }

  static async sendVerificationEmail(email: string): Promise<void> {
    const [user] = await db.select({ id: botUsers.id }).from(botUsers).where(eq(botUsers.email, email));
    if (!user) return;

    const token = jwt.sign({ email }, env.SECRET_KEY, { expiresIn: '1h' });

    await db.insert(emailVerifications).values({ userId: user.id, token });

    try {
      await notificationService.sendEmailVerification({
        to: email,
        verificationUrl: `${env.API_BASE_PATH}/email/verify/${token}`,
      });
    } catch (error) {
      logger.error({ err: error }, "Falha ao enviar e-mail de verificação");
    }
  }

  static async verificationEmail(token: string): Promise<void> {
    if (!token) throw new ValidationError("Token ausente");

    // `jwt.verify` já lança `TokenExpiredError` sozinho para um token vencido
    // (achado real ao escrever o teste desta fase): o `if (decodedToken.exp
    // < today)` que existia depois desta chamada nunca era alcançável — o
    // erro sempre estourava aqui antes, sem a mensagem amigável em PT-BR,
    // como uma exceção genérica não tratada.
    try {
      jwt.verify(token, env.SECRET_KEY);
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        await db.update(emailVerifications).set({ status: "expired" }).where(eq(emailVerifications.token, token));
        throw new ValidationError("Token inválido ou expirado! Realize o login para solicitar um novo email de confirmação");
      }
      throw new ValidationError("Token inválido");
    }

    const [verification] = await db.select().from(emailVerifications).where(eq(emailVerifications.token, token));
    if (!verification) throw new ValidationError("Token inválido");

    const [user] = await db.select({ verifiedEmailAt: botUsers.verifiedEmailAt }).from(botUsers).where(eq(botUsers.id, verification.userId));

    if (user?.verifiedEmailAt) {
      await db.update(emailVerifications).set({ status: "checked" }).where(eq(emailVerifications.userId, verification.userId));
      throw new ConflictError("Email já validado");
    }

    await db.update(emailVerifications).set({ status: "checked" }).where(eq(emailVerifications.userId, verification.userId));
    await db.update(botUsers).set({ verifiedEmailAt: new Date() }).where(eq(botUsers.id, verification.userId));
  }
}
