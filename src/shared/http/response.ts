import { Response } from "express";

interface SuccessBody<T> {
  success: true;
  data: T;
}

interface ErrorBody {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
  requestId?: string;
}

export function ok<T>(res: Response, data: T, statusCode = 200): Response<SuccessBody<T>> {
  return res.status(statusCode).json({ success: true, data });
}

export function fail(
  res: Response,
  params: { statusCode: number; code: string; message: string; details?: unknown; requestId?: string },
): Response<ErrorBody> {
  return res.status(params.statusCode).json({
    success: false,
    error: { code: params.code, message: params.message, details: params.details },
    requestId: params.requestId,
  });
}
