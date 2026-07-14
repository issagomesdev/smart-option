import { describe, expect, it } from "vitest";
import { AppError } from "./app-error";
import {
  ConflictError,
  ExternalServiceError,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from "./http-errors";

describe("hierarquia de erros", () => {
  it.each([
    [new ValidationError(), 400, "VALIDATION_ERROR"],
    [new UnauthorizedError(), 401, "UNAUTHORIZED"],
    [new ForbiddenError(), 403, "FORBIDDEN"],
    [new NotFoundError(), 404, "NOT_FOUND"],
    [new ConflictError(), 409, "CONFLICT"],
    [new ExternalServiceError(), 502, "EXTERNAL_SERVICE_ERROR"],
  ])("%s mapeia para o status code e errorCode corretos", (error, statusCode, errorCode) => {
    expect(error).toBeInstanceOf(AppError);
    expect(error.statusCode).toBe(statusCode);
    expect(error.errorCode).toBe(errorCode);
    expect(error.isOperational).toBe(true);
  });

  it("aceita mensagem e detalhes customizados", () => {
    const error = new ValidationError("Campo obrigatório ausente", { field: "email" });

    expect(error.message).toBe("Campo obrigatório ausente");
    expect(error.details).toEqual({ field: "email" });
  });

  it("usa mensagem padrão em PT-BR quando nenhuma é informada", () => {
    const error = new NotFoundError();

    expect(error.message).toBe("Recurso não encontrado.");
  });
});
