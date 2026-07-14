import express, { NextFunction, Request, Response } from "express";
import { AuthenticationService } from "../../services/authentication.service";
import { authenticateToken } from "../middlewares/auth.interceptor";
import { validate } from "../../infrastructure/http/middlewares/validate";
import { loginDto, refreshTokenDto } from "../../interfaces/http/dtos/auth.dto";
import { createRateLimiter } from "../../infrastructure/http/security";
import { ok } from "../../shared/http/response";
import { UnauthorizedError } from "../../shared/errors";

/** Limite mais restrito que o global — o login é o principal alvo de brute-force. */
const loginRateLimiter = createRateLimiter({ windowMs: 15 * 60 * 1000, max: 10, prefix: "rl:auth-login:" });

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

      ok(res, { user });
    } catch (error) {
      next(error);
    }
  });
