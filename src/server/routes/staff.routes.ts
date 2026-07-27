import express, { NextFunction, Request, Response } from "express";
import { StaffService } from "../../services/staff.service";
import { validate } from "../../infrastructure/http/middlewares/validate";
import { createStaffDto, staffIdParamDto, staffListQueryDto, updateStaffRoleDto } from "../../interfaces/http/dtos/staff.dto";
import { ok } from "../../shared/http/response";
import { UnauthorizedError } from "../../shared/errors";
import { denyInDemo } from "../middlewares/auth.interceptor";

// `requirePermission('staff.manage')` é aplicado uma vez no mount deste
// router (`server/routes/index.ts`), mesmo padrão de `roles.routes.ts`.
//
// `denyInDemo` vai só nas escritas, não no mount: na demonstração a tela de Equipe continua
// navegável (é parte do produto que se quer mostrar), mas criar/reatribuir/desativar staff fica
// bloqueado — senão um visitante conseguiria desativar contas e trancar o painel para os próximos.
export default express
  .Router()
  .get("/", validate({ query: staffListQueryDto }), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { page, limit } = req.query as unknown as { page: number; limit: number };
      ok(res, await StaffService.list({ page, limit }));
    } catch (error) {
      next(error);
    }
  })
  // Detalhe de um staff — a tela de edição do painel (Fase 5 parte 7) precisa
  // ler nome/sobrenome/e-mail/papel atual de um staff específico antes de
  // reatribuir o papel; sem esta rota não haveria como popular esse formulário.
  .get("/:id", validate({ params: staffIdParamDto }), async (req: Request, res: Response, next: NextFunction) => {
    try {
      ok(res, await StaffService.getById(Number(req.params.id)));
    } catch (error) {
      next(error);
    }
  })
  .post("/", denyInDemo(), validate({ body: createStaffDto }), async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) throw new UnauthorizedError();
      ok(res, await StaffService.create(req.body, req.user.permissions), 201);
    } catch (error) {
      next(error);
    }
  })
  .patch("/:id/role", denyInDemo(), validate({ params: staffIdParamDto, body: updateStaffRoleDto }), async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) throw new UnauthorizedError();
      ok(res, await StaffService.reassignRole(Number(req.params.id), req.body.roleId, req.user.permissions));
    } catch (error) {
      next(error);
    }
  })
  .delete("/:id", denyInDemo(), validate({ params: staffIdParamDto }), async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) throw new UnauthorizedError();
      ok(res, await StaffService.deactivate(Number(req.params.id), req.user.id));
    } catch (error) {
      next(error);
    }
  });
