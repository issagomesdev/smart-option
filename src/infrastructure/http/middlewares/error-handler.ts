import { NextFunction, Request, Response } from "express";
import { AppError } from "../../../shared/errors";
import { fail } from "../../../shared/http/response";
import { isProduction } from "../../../config/env";

export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction): void {
  const requestId = req.id as string | undefined;

  if (err instanceof AppError) {
    if (!err.isOperational) {
      req.log.error({ err }, "Erro operacional inesperado");
    }
    fail(res, {
      statusCode: err.statusCode,
      code: err.errorCode,
      message: err.message,
      details: err.details,
      requestId,
    });
    return;
  }

  req.log.error({ err }, "Erro não tratado");
  fail(res, {
    statusCode: 500,
    code: "INTERNAL_SERVER_ERROR",
    message: isProduction
      ? "Erro interno do servidor."
      : err instanceof Error
        ? err.message
        : "Erro interno do servidor.",
    requestId,
  });
}
