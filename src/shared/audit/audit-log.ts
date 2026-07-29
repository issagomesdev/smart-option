import { db } from "../../infrastructure/database/client";
import { auditLogs } from "../../infrastructure/database/schema";
import { logger } from "../logger";

/**
 * Ações administrativas rastreadas. A união fechada existe para que uma ação nova apareça no
 * autocomplete (e no filtro do painel) em vez de virar uma string solta digitada errado — o mesmo
 * motivo pelo qual `Permission` é uma união e não `string`.
 */
export const AUDIT_ACTIONS = [
  // Equipe
  "staff.created",
  "staff.updated",
  "staff.role_changed",
  // `staff.deactivated` é histórica: a ação de desativar (soft-delete) foi substituída por exclusão
  // definitiva, mas linhas antigas com essa ação continuam no banco e precisam de rótulo/filtro.
  "staff.deactivated",
  "staff.deleted",
  // Papéis
  "role.created",
  "role.updated",
  "role.deleted",
  // Usuários do bot
  "bot_user.created",
  "bot_user.updated",
  "bot_user.deleted",
  "bot_user.blocked",
  "bot_user.unblocked",
  // Financeiro
  "wallet.admin_credit",
  "wallet.admin_debit",
  "withdrawal.approved",
  "withdrawal.refused",
  // Suporte
  "support.marked_read",
] as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export interface AuditActor {
  id: number;
  email: string;
}

export interface RecordAuditInput {
  action: AuditAction;
  entityType: string;
  entityId: string | number;
  actor?: AuditActor | null;
  before?: unknown;
  after?: unknown;
}

/**
 * Grava uma linha na trilha de auditoria.
 *
 * **Nunca lança.** Uma falha ao auditar não pode desfazer nem impedir a operação que já aconteceu —
 * um saque aprovado com o log perdido é ruim, mas um erro 500 depois da transferência PIX já ter
 * saído é pior. A falha vai para o log da aplicação, onde é visível sem quebrar o fluxo do usuário.
 *
 * O `actorEmail` é desnormalizado dentro de `after` de propósito: `actorId` não tem FK (o ator pode
 * ser staff, usuário do bot ou o próprio sistema), então guardar o e-mail preserva quem agiu mesmo
 * que a conta seja renomeada ou desativada depois.
 */
export async function recordAudit({
  action,
  entityType,
  entityId,
  actor,
  before,
  after,
}: RecordAuditInput): Promise<void> {
  try {
    await db.insert(auditLogs).values({
      actorType: "staff_user",
      actorId: actor?.id ?? null,
      action,
      entityType,
      entityId: String(entityId),
      before: before ?? null,
      after: {
        ...(after && typeof after === "object" ? after : { value: after }),
        actorEmail: actor?.email ?? null,
      },
    });
  } catch (error) {
    logger.error({ err: error, action, entityType, entityId }, "Falha ao gravar a trilha de auditoria");
  }
}
