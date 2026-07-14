import { NextFunction, Request, Response } from "express";
import { verify } from "jsonwebtoken";
import { eq } from "drizzle-orm";
import { db } from "../../infrastructure/database/client";
import { staffUsers } from "../../infrastructure/database/schema";
import { env } from "../../config/env";
import { UnauthorizedError } from "../../shared/errors";

export interface AuthenticatedRequest extends Request {
  user?: {
    id: number;
    name: string;
    surname: string;
    email: string;
    roleId: number;
  };
}

export async function authenticateToken(token: string) {
  let payload: { userId: number };
  try {
    payload = verify(token, env.SECRET_KEY) as { userId: number };
  } catch {
    return null;
  }

  const [user] = await db
    .select({ id: staffUsers.id, name: staffUsers.name, surname: staffUsers.surname, email: staffUsers.email, roleId: staffUsers.roleId })
    .from(staffUsers)
    .where(eq(staffUsers.id, payload.userId));

  return user ?? null;
}

/**
 * Corrige um bug do código original: as respostas de erro chamavam `next()`
 * logo depois de `res.status(...).json(...)`, continuando a cadeia de
 * middlewares após já ter respondido (risco de "headers already sent"). Aqui
 * só existe um caminho de saída por requisição: ou `next()` sem resposta
 * prévia, ou `next(error)` sem nunca ter chamado `res.json` antes.
 */
export function authorize() {
  return async (req: AuthenticatedRequest, _res: Response, next: NextFunction): Promise<void> => {
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
