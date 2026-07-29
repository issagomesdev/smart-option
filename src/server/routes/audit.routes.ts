import express, { NextFunction, Request, Response } from "express";
import { AuditService } from "../../services/audit.service";
import { AuditActionsService } from "../../services/audit-actions.service";
import { validate } from "../../infrastructure/http/middlewares/validate";
import { auditFiltersDto, type AuditFilters } from "../../interfaces/http/dtos/audit.dto";
import { auditActionFiltersDto, type AuditActionFilters } from "../../interfaces/http/dtos/audit-actions.dto";
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
  })
  /**
   * Trilha de ações administrativas — quem alterou o quê no painel (equipe, papéis, usuários do
   * bot, saldo, saques e suporte). Complementa `POST /` acima, que cobre o dinheiro que se moveu.
   *
   * Leitura aberta a qualquer staff autenticado, mesma convenção do resto das consultas: uma trilha
   * de auditoria que só quem administra consegue ver perde boa parte do efeito de transparência.
   */
  .post("/actions", validate({ body: auditActionFiltersDto }), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const filters = req.body as AuditActionFilters;
      ok(res, await AuditActionsService.list(filters));
    } catch (error) {
      next(error);
    }
  });
