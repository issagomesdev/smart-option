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
import { recordAudit, type AuditActor } from "../../shared/audit/audit-log";
import { logger } from "../../shared/logger";
import { notificationService } from "../../notifications/services/notification.service";

export const EMAIL_TAKEN_MESSAGE =
  "Este e-mail já está cadastrado. Faça login na sua conta ou informe outro e-mail para continuar o cadastro.";

export const CPF_TAKEN_MESSAGE =
  "Este CPF já está cadastrado. Faça login na sua conta ou informe outro CPF para continuar o cadastro.";

/**
 * Descobre qual campo violou a chave única a partir do erro do MySQL. A mensagem do driver traz o
 * nome do índice (`bot_users_email_unique`), então dá para responder ao usuário exatamente qual
 * dado já existe em vez de uma mensagem genérica. Espelha `isDuplicateEmailError` de
 * `staff.service.ts`, que faz a mesma leitura de `code`/`cause.code`.
 */
function duplicateEntryField(error: unknown): "email" | "cpf" | null {
  const candidate = error as { code?: string; message?: string; cause?: { code?: string; message?: string } } | undefined;
  const code = candidate?.code ?? candidate?.cause?.code;
  if (code !== "ER_DUP_ENTRY") return null;

  const message = `${candidate?.message ?? ""} ${candidate?.cause?.message ?? ""}`;
  if (message.includes("email")) return "email";
  if (message.includes("cpf")) return "cpf";
  return null;
}

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
  /**
   * `actor` só é informado quando o cadastro parte do painel administrativo. O autocadastro pelo
   * Telegram passa `null` e não gera linha de auditoria — a trilha existe para rastrear ações de
   * administradores, e registrar cada usuário que se cadastra sozinho só a encheria de ruído.
   */
  static async registerUser(body: RegisterUserInput, affiliateId: number | null = null, actor: AuditActor | null = null) {
    if (!isValidCpf(body.cpf)) throw new ValidationError("CPF inválido");

    const cpf = normalizeCpf(body.cpf);

    // Pré-checagem só para dar a mensagem certa (qual campo está duplicado) antes de gastar o hash
    // da senha. Ela NÃO é a garantia: duas requisições simultâneas passam as duas por aqui antes de
    // qualquer INSERT commitar. Quem garante é a chave única no banco, tratada no catch abaixo.
    const [existingEmail] = await db.select({ id: botUsers.id }).from(botUsers).where(eq(botUsers.email, body.email));
    if (existingEmail) throw new ConflictError(EMAIL_TAKEN_MESSAGE);

    const [existingCpf] = await db.select({ id: botUsers.id }).from(botUsers).where(eq(botUsers.cpf, cpf));
    if (existingCpf) throw new ConflictError(CPF_TAKEN_MESSAGE);

    let inserted: { id: number };
    try {
      [inserted] = await db
        .insert(botUsers)
        .values({
          name: body.name,
          email: body.email,
          password: await hashPassword(body.password),
          phoneNumber: body.phone_number,
          cpf,
          adress: body.adress,
          pixCode: body.pix_code,
        })
        .$returningId();
    } catch (error) {
      // Sem isto, uma violação de chave única sobe como erro cru do driver — foi assim que o
      // usuário recebeu no Telegram o INSERT inteiro com e-mail e hash da senha dentro.
      const duplicated = duplicateEntryField(error);
      if (duplicated === "email") throw new ConflictError(EMAIL_TAKEN_MESSAGE);
      if (duplicated === "cpf") throw new ConflictError(CPF_TAKEN_MESSAGE);
      throw error;
    }

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

    if (actor) {
      await recordAudit({
        action: "bot_user.created",
        entityType: "bot_users",
        entityId: inserted.id,
        actor,
        after: { name: body.name, email: body.email },
      });
    }

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
