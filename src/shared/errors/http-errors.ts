import { AppError, AppErrorDetails } from "./app-error";

export class ValidationError extends AppError {
  readonly statusCode = 400;
  readonly errorCode = "VALIDATION_ERROR";

  constructor(message = "Solicitação inválida.", details?: AppErrorDetails) {
    super(message, details);
  }
}

export class UnauthorizedError extends AppError {
  readonly statusCode = 401;
  readonly errorCode = "UNAUTHORIZED";

  constructor(message = "Acesso autorizado apenas para usuários autenticados.") {
    super(message);
  }
}

export class ForbiddenError extends AppError {
  readonly statusCode = 403;
  readonly errorCode = "FORBIDDEN";

  constructor(message = "Você não tem permissão para acessar essa informação.") {
    super(message);
  }
}

export class NotFoundError extends AppError {
  readonly statusCode = 404;
  readonly errorCode = "NOT_FOUND";

  constructor(message = "Recurso não encontrado.") {
    super(message);
  }
}

export class ConflictError extends AppError {
  readonly statusCode = 409;
  readonly errorCode = "CONFLICT";

  constructor(message = "Operação em conflito com o estado atual do recurso.") {
    super(message);
  }
}

export class ExternalServiceError extends AppError {
  readonly statusCode = 502;
  readonly errorCode = "EXTERNAL_SERVICE_ERROR";

  constructor(message = "Falha ao se comunicar com um serviço externo.", details?: AppErrorDetails) {
    super(message, details);
  }
}
