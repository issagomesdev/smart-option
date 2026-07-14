import { Response } from "express";
import { describe, expect, it, vi } from "vitest";
import { fail, ok } from "./response";

function createMockResponse(): Response {
  const res = {} as Response;
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

describe("envelope de resposta HTTP", () => {
  it("ok() responde com success=true, os dados e o status informado", () => {
    const res = createMockResponse();

    ok(res, { id: 1 }, 201);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({ success: true, data: { id: 1 } });
  });

  it("ok() usa 200 como status padrão", () => {
    const res = createMockResponse();

    ok(res, { id: 1 });

    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("fail() responde com success=false e o erro estruturado", () => {
    const res = createMockResponse();

    fail(res, {
      statusCode: 404,
      code: "NOT_FOUND",
      message: "Recurso não encontrado.",
      requestId: "req-123",
    });

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: { code: "NOT_FOUND", message: "Recurso não encontrado.", details: undefined },
      requestId: "req-123",
    });
  });
});
