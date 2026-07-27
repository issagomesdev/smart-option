import express, { NextFunction, Request, Response } from "express";
import { AuditService } from "../../services/audit.service";
import { validate } from "../../infrastructure/http/middlewares/validate";
import { auditFiltersDto, type AuditFilters } from "../../interfaces/http/dtos/audit.dto";
import { ok } from "../../shared/http/response";

// Corpo (não query string) de propósito — o filtro tem campos demais (período, tipo, status,
// usuário, valor mín/máx, busca, ordenação, paginação) pra caber bem numa query string, mesmo
// padrão já usado em `requests.routes.ts` para os filtros de listagem mais recentes.
export default express
  .Router()
  .post("/", validate({ body: auditFiltersDto }), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const filters = req.body as AuditFilters;
      ok(res, await AuditService.list(filters));
    } catch (error) {
      next(error);
    }
  });
