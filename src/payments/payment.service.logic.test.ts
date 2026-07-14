import { describe, expect, it } from "vitest";
import { isDuplicateKeyError, mapAsaasStatus } from "./payment.service";

describe("isDuplicateKeyError", () => {
  it("reconhece o código no topo do erro", () => {
    expect(isDuplicateKeyError({ code: "ER_DUP_ENTRY" })).toBe(true);
  });

  it("reconhece o código dentro de error.cause — como o Drizzle envolve o erro do mysql2 em DrizzleQueryError", () => {
    expect(isDuplicateKeyError({ message: "Failed query", cause: { code: "ER_DUP_ENTRY" } })).toBe(true);
  });

  it("retorna false para outros erros", () => {
    expect(isDuplicateKeyError({ code: "ER_NO_SUCH_TABLE" })).toBe(false);
    expect(isDuplicateKeyError({ cause: { code: "ER_NO_SUCH_TABLE" } })).toBe(false);
    expect(isDuplicateKeyError(new Error("qualquer coisa"))).toBe(false);
    expect(isDuplicateKeyError(null)).toBe(false);
  });
});

describe("mapAsaasStatus", () => {
  it.each([
    ["RECEIVED", "confirmed"],
    ["CONFIRMED", "confirmed"],
    ["RECEIVED_IN_CASH", "confirmed"],
    ["DONE", "confirmed"],
    ["REFUNDED", "refunded"],
    ["CANCELLED", "cancelled"],
    ["FAILED", "failed"],
    ["OVERDUE", "failed"],
    ["BANK_PROCESSING", "processing"],
    ["PENDING", "pending"],
    ["SOME_UNKNOWN_STATUS", "processing"],
  ] as const)("mapeia %s para %s", (asaasStatus, expected) => {
    expect(mapAsaasStatus(asaasStatus)).toBe(expected);
  });
});
