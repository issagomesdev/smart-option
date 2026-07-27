import express, { NextFunction, Request, Response } from "express";
import { AuthenticationService } from "../../services/authentication.service";
import { authenticateToken } from "../middlewares/auth.interceptor";
import { validate } from "../../infrastructure/http/middlewares/validate";
import { loginDto, refreshTokenDto } from "../../interfaces/http/dtos/auth.dto";
import { createRateLimiter } from "../../infrastructure/http/security";
import { ok } from "../../shared/http/response";
import { NotFoundError, UnauthorizedError } from "../../shared/errors";
import { isDemo } from "../../config/demo";

/** Limite mais restrito que o global — o login é o principal alvo de brute-force. */
const loginRateLimiter = createRateLimiter({ windowMs: 15 * 60 * 1000, max: 10, prefix: "rl:auth-login:" });

/**
 * Limite próprio (e mais generoso) para o login de visitante: não há senha para adivinhar, então o
 * risco não é brute-force e sim abuso de criação de sessão. Prefixo separado impede que visitantes
 * esgotem a cota do login com credencial — foi exatamente esse acoplamento que travou a suíte E2E
 * deste projeto antes.
 */
const demoLoginRateLimiter = createRateLimiter({ windowMs: 15 * 60 * 1000, max: 60, prefix: "rl:auth-demo:" });

export default express
  .Router()
  .post("/", loginRateLimiter, validate({ body: loginDto }), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email, password, remember } = req.body;
      const response = await AuthenticationService.login(email, password, remember);
      ok(res, response);
    } catch (error) {
      next(error);
    }
  })
  /**
   * Login de visitante do modo demonstração — sem corpo, sem credencial.
   *
   * Fora do modo demonstração a rota responde 404, e não 403: um 403 confirmaria que o recurso
   * existe. Com `APP_DEMO=false` o objetivo é que a rota simplesmente não exista para quem sonda.
   *
   * Tem rate limit próprio (prefixo separado do login normal) para que uma enxurrada de visitantes
   * não consuma a cota de tentativas do login com credencial, e vice-versa.
   */
  .post("/demo-login", demoLoginRateLimiter, async (_req: Request, res: Response, next: NextFunction) => {
    try {
      if (!isDemo) throw new NotFoundError("Recurso não encontrado");
      ok(res, await AuthenticationService.demoLogin());
    } catch (error) {
      next(error);
    }
  })
  .post("/refresh", validate({ body: refreshTokenDto }), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tokens = await AuthenticationService.refresh(req.body.refreshToken);
      ok(res, tokens);
    } catch (error) {
      next(error);
    }
  })
  .post("/logout", validate({ body: refreshTokenDto }), async (req: Request, res: Response, next: NextFunction) => {
    try {
      await AuthenticationService.logout(req.body.refreshToken);
      ok(res, { loggedOut: true });
    } catch (error) {
      next(error);
    }
  })
  // Mantido por compatibilidade com o painel atual, que ainda envia o token
  // manualmente em vez de usar o header Authorization + `authorize()`.
  .post("/token", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const token = req.header("Authorization")?.replace("Bearer ", "");
      if (!token) throw new UnauthorizedError("Token não informado");

      const user = await authenticateToken(token);
      if (!user) throw new UnauthorizedError("Token inválido ou expirado");

      // `isDemo` viaja junto da sessão para que o painel descubra o modo pelo backend (a fonte da
      // verdade) em vez de precisar de uma variável de ambiente própria, que poderia divergir.
      ok(res, { user, isDemo });
    } catch (error) {
      next(error);
    }
  });
