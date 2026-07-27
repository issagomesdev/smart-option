import express, { NextFunction, Request, Response } from "express";
import { RolesService } from "../../services/roles.service";
import { validate } from "../../infrastructure/http/middlewares/validate";
import { createRoleDto, roleIdParamDto, updateRoleDto } from "../../interfaces/http/dtos/roles.dto";
import { ok } from "../../shared/http/response";
import { UnauthorizedError } from "../../shared/errors";
import { denyInDemo, requireAnyPermission, requirePermission } from "../middlewares/auth.interceptor";

// Escrita (`POST`/`PATCH`/`DELETE`) exige `roles.manage` estritamente — mesmo
// recurso "tudo ou nada" da parte 4. `GET` é a exceção (Fase 5 parte 7):
// atribuir um papel a um staff (`staff.manage`) exige poder ver a lista de
// papéis disponíveis primeiro, então aceita `staff.manage` OU `roles.manage`.
export default express
  .Router()
  .get("/", requireAnyPermission("staff.manage", "roles.manage"), async (_req: Request, res: Response, next: NextFunction) => {
    try {
      ok(res, await RolesService.list());
    } catch (error) {
      next(error);
    }
  })
  // Detalhe de um papel — a tela de edição de papéis do painel (Fase 5 parte
  // 8) precisa ler nome/descrição/permissões atuais antes de editar. Gateado
  // só por `roles.manage` (não `requireAnyPermission`): diferente da
  // listagem, ninguém com só `staff.manage` precisa do detalhe de um papel
  // específico — só de saber quais existem, para o seletor de atribuição.
  .get(
    "/:id",
    requirePermission("roles.manage"),
    validate({ params: roleIdParamDto }),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        ok(res, await RolesService.getById(Number(req.params.id)));
      } catch (error) {
        next(error);
      }
    },
  )
  // Escritas bloqueadas na demonstração (leitura continua liberada): editar papéis permitiria a um
  // visitante remover permissões do papel `admin` e inutilizar o painel até o próximo reset.
  .post("/", requirePermission("roles.manage"), denyInDemo(), validate({ body: createRoleDto }), async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) throw new UnauthorizedError();
      ok(res, await RolesService.create(req.body, req.user.permissions), 201);
    } catch (error) {
      next(error);
    }
  })
  .patch(
    "/:id",
    requirePermission("roles.manage"),
    denyInDemo(),
    validate({ params: roleIdParamDto, body: updateRoleDto }),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        if (!req.user) throw new UnauthorizedError();
        ok(res, await RolesService.update(Number(req.params.id), req.body, req.user.permissions));
      } catch (error) {
        next(error);
      }
    },
  )
  .delete("/:id", requirePermission("roles.manage"), denyInDemo(), validate({ params: roleIdParamDto }), async (req: Request, res: Response, next: NextFunction) => {
    try {
      ok(res, await RolesService.delete(Number(req.params.id)));
    } catch (error) {
      next(error);
    }
  });
