import { redis } from "../infrastructure/cache/redis";

export type BotFlow =
  | "login"
  | "register"
  | "deposit"
  | "withdrawal"
  | "transfer"
  | "products"
  | "support";

export interface BotSession {
  flow: BotFlow | null;
  step: string | null;
  data: Record<string, unknown>;
}

const SESSION_PREFIX = "bot:session:";
const SESSION_TTL_SECONDS = 30 * 60;
const EMPTY_SESSION: BotSession = { flow: null, step: null, data: {} };

function sessionKey(userId: number): string {
  return `${SESSION_PREFIX}${userId}`;
}

/**
 * Estado de conversa por usuário do Telegram, em Redis. Substitui as
 * variáveis `let` de módulo que o bot usava antes (`section`, `mode`,
 * `current_field`, `answers`, etc.) — que eram compartilhadas por *todos* os
 * usuários simultâneos do processo, causando corrupção de dados entre
 * conversas concorrentes. TTL de 30 min: uma conversa abandonada expira
 * sozinha em vez de vazar estado para a próxima interação do mesmo usuário
 * indefinidamente (bug existente antes, ex.: `affiliate` nunca era limpo se
 * o cadastro fosse abandonado).
 */
export class SessionService {
  async get(userId: number): Promise<BotSession> {
    const raw = await redis.get(sessionKey(userId));
    if (!raw) return { ...EMPTY_SESSION, data: {} };

    try {
      return JSON.parse(raw) as BotSession;
    } catch {
      return { ...EMPTY_SESSION, data: {} };
    }
  }

  async set(userId: number, session: BotSession): Promise<void> {
    await redis.set(sessionKey(userId), JSON.stringify(session), "EX", SESSION_TTL_SECONDS);
  }

  async patchData(userId: number, patch: Record<string, unknown>): Promise<BotSession> {
    const current = await this.get(userId);
    const next: BotSession = { ...current, data: { ...current.data, ...patch } };
    await this.set(userId, next);
    return next;
  }

  async enterFlow(userId: number, flow: BotFlow, step: string | null = null, data: Record<string, unknown> = {}): Promise<BotSession> {
    const session: BotSession = { flow, step, data };
    await this.set(userId, session);
    return session;
  }

  async setStep(userId: number, step: string | null): Promise<BotSession> {
    const current = await this.get(userId);
    const next: BotSession = { ...current, step };
    await this.set(userId, next);
    return next;
  }

  async clear(userId: number): Promise<void> {
    await redis.del(sessionKey(userId));
  }
}

export const sessionService = new SessionService();
