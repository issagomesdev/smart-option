import express, { NextFunction, Request, Response } from "express";
import { RequestService } from "../../services/requests.service";
import { validate } from "../../infrastructure/http/middlewares/validate";
import {
  depositFiltersDto,
  extractFiltersDto,
  requestsUserIdParamDto,
  resWithdrawalDto,
  subscriptionFiltersDto,
  supportFiltersDto,
  wasReadParamsDto,
  withdrawalFiltersDto,
} from "../../interfaces/http/dtos/admin.dto";
import { ok } from "../../shared/http/response";
import { requirePermission } from "../middlewares/auth.interceptor";

export default express
  .Router()
  .get("/extract/:id", validate({ params: requestsUserIdParamDto }), async (req: Request, res: Response, next: NextFunction) => {
    try {
      ok(res, await RequestService.extract(Number(req.params.id) || null));
    } catch (error) {
      next(error);
    }
  })
  .post(
    "/extract/:id",
    validate({ params: requestsUserIdParamDto, body: extractFiltersDto }),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        ok(res, await RequestService.extract(Number(req.params.id) || null, req.body));
      } catch (error) {
        next(error);
      }
    },
  )
  .post(
    "/withdrawal/:id",
    validate({ params: requestsUserIdParamDto, body: withdrawalFiltersDto }),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        ok(res, await RequestService.withdrawalRequests(Number(req.params.id) || null, req.body));
      } catch (error) {
        next(error);
      }
    },
  )
  .post(
    "/deposit/:id",
    validate({ params: requestsUserIdParamDto, body: depositFiltersDto }),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        ok(res, await RequestService.depositsRequests(Number(req.params.id) || null, req.body));
      } catch (error) {
        next(error);
      }
    },
  )
  .post(
    "/support/:id",
    validate({ params: requestsUserIdParamDto, body: supportFiltersDto }),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        ok(res, await RequestService.supportRequests(Number(req.params.id) || null, req.body));
      } catch (error) {
        next(error);
      }
    },
  )
  .post(
    "/subscription/:id",
    validate({ params: requestsUserIdParamDto, body: subscriptionFiltersDto }),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        ok(res, await RequestService.subscriptionsRequests(Number(req.params.id) || null, req.body));
      } catch (error) {
        next(error);
      }
    },
  )
  // Bug corrigido: o código original chamava `resWithdrawal(req.body.res)`,
  // passando só o booleano em vez do corpo inteiro — o service espera
  // `body.id`/`body.observation` também, então a aprovação/rejeição de saque
  // nunca funcionou corretamente através desta rota.
  .post(
    "/res-withdrawal",
    requirePermission("withdrawals.approve"),
    validate({ body: resWithdrawalDto }),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        ok(res, await RequestService.resWithdrawal(req.body, req.user ?? null));
      } catch (error) {
        next(error);
      }
    },
  )
  .patch(
    "/was-read/:id/:status",
    requirePermission("support.write"),
    validate({ params: wasReadParamsDto }),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        ok(res, await RequestService.wasRead(req.params.id, req.params.status));
      } catch (error) {
        next(error);
      }
    },
  )
  .get("/pendencies", async (_req: Request, res: Response, next: NextFunction) => {
    try {
      ok(res, await RequestService.pendingRequests());
    } catch (error) {
      next(error);
    }
  });
