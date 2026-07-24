import { NextFunction, Request, Response } from "express";
import { verify } from "jsonwebtoken";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "../../infrastructure/database/client";
import { roles, staffUsers } from "../../infrastructure/database/schema";
import { env } from "../../config/env";
import { ForbiddenError, UnauthorizedError } from "../../shared/errors";
import type { Permission } from "../../shared/permissions/permissions";

/**
 * Aumento global do `Request` do Express (Fase 5 parte 3, RBAC) — substitui
 * a antiga interface local `AuthenticatedRequest`, que exigia toda rota que
 * quisesse `req.user` tipado importar e usar esse tipo explicitamente (na
 * prática, a maioria não fazia isso e caía para `req: any`, ex.:
 * `transf-user-admin` em `users.routes.ts`). Com a augmentation, `req.user`
 * já vem tipado em qualquer handler `(req: Request, ...)`.
 */
declare global {
  // `declare global { namespace Express {...} } }` é a forma documentada pelo
  // próprio Express/@types/express de aumentar `Request` — não existe
  // alternativa em sintaxe de módulo ES2015 para este caso de ambient module augmentation.
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: {
        id: number;
        name: string;
        surname: string;
        email: string;
        roleId: number;
        /** Permissões do papel atual do staff — sempre um array (nunca `undefined`), mesmo que vazio. */
        permissions: Permission[];
      };
    }
  }
}

/** Mantido só por compatibilidade de import — `Request` já vem com `user` tipado desde a augmentation acima. */
export type AuthenticatedRequest = Request;

export async function authenticateToken(token: string) {
  let payload: { userId: number };
  try {
    payload = verify(token, env.SECRET_KEY) as { userId: number };
  } catch {
    return null;
  }

  // INNER JOIN de propósito: com a FK (Fase 5 parte 3) todo `role_id` válido
  // tem uma linha correspondente em `roles`, então um join sem match só pode
  // significar dado inconsistente — melhor tratar como "não autenticado" do
  // que devolver um usuário sem permissões nenhuma por engano.
  // `deletedAt IS NULL`: staff desativado (soft-delete, Fase 5) não passa
  // mais daqui — efeito imediato na próxima requisição, sem esperar o token
  // expirar (mesma leitura fresca que já fazia o `roleId` valer na hora).
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
    .where(and(eq(staffUsers.id, payload.userId), isNull(staffUsers.deletedAt)));

  if (!user) return null;

  // Padrão defensivo (fail closed): mesmo a coluna sendo NOT NULL, nunca
  // deixar `permissions` como `undefined` sair daqui.
  return { ...user, permissions: user.permissions ?? [] };
}

/**
 * Corrige um bug do código original: as respostas de erro chamavam `next()`
 * logo depois de `res.status(...).json(...)`, continuando a cadeia de
 * middlewares após já ter respondido (risco de "headers already sent"). Aqui
 * só existe um caminho de saída por requisição: ou `next()` sem resposta
 * prévia, ou `next(error)` sem nunca ter chamado `res.json` antes.
 */
export function authorize() {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    const header = req.header("Authorization");
    const token = header?.startsWith("Bearer ") ? header.slice("Bearer ".length) : undefined;

    if (!token) {
      next(new UnauthorizedError());
      return;
    }

    try {
      const user = await authenticateToken(token);
      if (!user) {
        next(new UnauthorizedError());
        return;
      }

      req.user = user;
      next();
    } catch {
      next(new UnauthorizedError("Token inválido ou expirado"));
    }
  };
}

/**
 * Middleware de autorização por rota (RBAC, Fase 5 parte 3) — aplicado
 * depois de `authorize()`, rota a rota nas ações de escrita sensíveis
 * (nunca no grupo inteiro de um router misto) ou uma vez no mount de um
 * router "tudo ou nada" (`staff.routes.ts`/`roles.routes.ts`, partes 4/5).
 */
export function requirePermission(permission: Permission) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(new UnauthorizedError());
      return;
    }

    if (!req.user.permissions.includes(permission)) {
      next(new ForbiddenError(`Esta ação exige a permissão "${permission}".`));
      return;
    }

    next();
  };
}

/**
 * Variante de `requirePermission` que aceita qualquer uma das permissões
 * listadas (não todas) — achado ao construir a Fase 5 parte 7 (telas de
 * Equipe do painel): `GET /api/roles` era gateado só por `roles.manage`
 * (recurso "tudo ou nada" da parte 4), mas atribuir um papel a um staff
 * (`staff.manage`, parte 5) exige poder *ler* a lista de papéis disponíveis
 * — as duas permissões são deliberadamente separadas (separação de
 * responsabilidade), então um staff só com `staff.manage` ficaria sem
 * conseguir ver os papéis para atribuir. `GET /api/roles` passou a aceitar
 * `staff.manage` OU `roles.manage`; escrita (`POST`/`PATCH`/`DELETE`)
 * continua exigindo `roles.manage` estritamente.
 */
export function requireAnyPermission(...permissions: Permission[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(new UnauthorizedError());
      return;
    }

    if (!permissions.some((permission) => req.user!.permissions.includes(permission))) {
      next(new ForbiddenError(`Esta ação exige uma destas permissões: ${permissions.join(", ")}.`));
      return;
    }

    next();
  };
}
