import express, { NextFunction, Request, Response } from "express";
import { DashboardService, type DashboardSummaryFilters } from "../../services/dash.service";
import { validate } from "../../infrastructure/http/middlewares/validate";
import { periodQueryDto } from "../../interfaces/http/dtos/admin.dto";
import { ok } from "../../shared/http/response";

export default express
  .Router()
  .get("/plans", async (_req: Request, res: Response, next: NextFunction) => {
    try {
      ok(res, await DashboardService.getPlans());
    } catch (error) {
      next(error);
    }
  })
  // Agregador do dashboard v2 (estilo Stripe) — KPIs, gráfico, indicador circular e as 10
  // movimentações mais recentes numa única resposta, cacheada por 45s.
  .get(
    "/summary",
    validate({ query: periodQueryDto }),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const filters = req.query as unknown as DashboardSummaryFilters;
        ok(res, await DashboardService.getSummary(filters));
      } catch (error) {
        next(error);
      }
    },
  );
