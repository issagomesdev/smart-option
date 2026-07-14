export interface AppErrorDetails {
  [key: string]: unknown;
}

/**
 * Base de toda exceção de negócio da aplicação. `isOperational=true` indica
 * uma falha esperada (entrada inválida, recurso ausente, etc.) que pode ser
 * respondida ao cliente com segurança — diferente de um bug/erro não tratado.
 */
export abstract class AppError extends Error {
  abstract readonly statusCode: number;
  abstract readonly errorCode: string;
  readonly isOperational = true;
  readonly details?: AppErrorDetails;

  constructor(message: string, details?: AppErrorDetails) {
    super(message);
    this.name = this.constructor.name;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }
}
