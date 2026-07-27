import express, { NextFunction, Request, Response } from "express";
import { PlansService } from "../../services/plans.service";
import { validate } from "../../infrastructure/http/middlewares/validate";
import { planFiltersDto, planIdParamDto, planInputDto, type PlanFilters } from "../../interfaces/http/dtos/plans.dto";
import { ok } from "../../shared/http/response";
import { requirePermission } from "../middlewares/auth.interceptor";

/**
 * Catálogo administrativo de planos. Leitura aberta a qualquer staff autenticado (mesma convenção
 * de `/api/audit` e do dashboard — o catálogo de permissões existe só para ações de escrita);
 * escrita exige `plans.manage`, aplicada rota a rota porque este router é misto.
 */
export default express
  .Router()
  .get("/", validate({ query: planFiltersDto }), async (req: Request, res: Response, next: NextFunction) => {
    try {
      ok(res, await PlansService.list(req.query as unknown as PlanFilters));
    } catch (error) {
      next(error);
    }
  })
  .get("/:id", validate({ params: planIdParamDto }), async (req: Request, res: Response, next: NextFunction) => {
    try {
      ok(res, await PlansService.getById(Number(req.params.id)));
    } catch (error) {
      next(error);
    }
  })
  .post(
    "/",
    requirePermission("plans.manage"),
    validate({ body: planInputDto }),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        ok(res, await PlansService.create(req.body), 201);
      } catch (error) {
        next(error);
      }
    },
  )
  .patch(
    "/:id",
    requirePermission("plans.manage"),
    validate({ params: planIdParamDto, body: planInputDto }),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        ok(res, await PlansService.update(Number(req.params.id), req.body));
      } catch (error) {
        next(error);
      }
    },
  )
  .delete(
    "/:id",
    requirePermission("plans.manage"),
    validate({ params: planIdParamDto }),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        ok(res, await PlansService.delete(Number(req.params.id)));
      } catch (error) {
        next(error);
      }
    },
  );
