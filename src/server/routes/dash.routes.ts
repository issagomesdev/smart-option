import express, { NextFunction, Request, Response } from "express";
import { DashboardService } from "../../services/dash.service";
import { validate } from "../../infrastructure/http/middlewares/validate";
import { dashBalanceParamsDto } from "../../interfaces/http/dtos/admin.dto";
import { ok } from "../../shared/http/response";

export default express
  .Router()
  .get("/users", async (_req: Request, res: Response, next: NextFunction) => {
    try {
      ok(res, await DashboardService.users());
    } catch (error) {
      next(error);
    }
  })
  .get(
    "/balance/:user_id/:product_id/:period",
    validate({ params: dashBalanceParamsDto }),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        ok(res, await DashboardService.balance(req.params.user_id, req.params.product_id, req.params.period));
      } catch (error) {
        next(error);
      }
    },
  )
  .get("/plans", async (_req: Request, res: Response, next: NextFunction) => {
    try {
      ok(res, await DashboardService.getPlans());
    } catch (error) {
      next(error);
    }
  });
