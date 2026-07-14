import { NextFunction, Request, Response } from "express";
import { ZodType } from "zod";
import { ValidationError } from "../../../shared/errors";

interface ValidationSchemas {
  body?: ZodType;
  params?: ZodType;
  query?: ZodType;
}

/**
 * Middleware de validação de entrada baseado em zod. Substitui `req.body`/
 * `req.params`/`req.query` pelo resultado já parseado (com defaults e
 * coerções aplicados), então o handler da rota nunca vê dado bruto não
 * validado. Falha vira `ValidationError` (400) com a lista de campos.
 */
export function validate(schemas: ValidationSchemas) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      if (schemas.body) {
        req.body = parse(schemas.body, req.body, "body");
      }
      if (schemas.params) {
        req.params = parse(schemas.params, req.params, "params") as typeof req.params;
      }
      if (schemas.query) {
        req.query = parse(schemas.query, req.query, "query") as typeof req.query;
      }
      next();
    } catch (error) {
      next(error);
    }
  };
}

function parse<T>(schema: ZodType<T>, data: unknown, location: string): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    const details = result.error.issues.map((issue) => ({
      field: issue.path.join(".") || location,
      message: issue.message,
    }));
    throw new ValidationError(`Dados inválidos em ${location}`, { issues: details });
  }
  return result.data;
}
