import { describe, expect, it } from "vitest";
import { offsetFor, paginate } from "./pagination";

describe("offsetFor", () => {
  it("página 1 não pula registros", () => {
    expect(offsetFor({ page: 1, limit: 20 })).toBe(0);
  });

  it("calcula o offset a partir da página e do limite", () => {
    expect(offsetFor({ page: 3, limit: 10 })).toBe(20);
  });
});

describe("paginate", () => {
  it("monta o envelope com os metadados corretos", () => {
    const result = paginate(["a", "b"], { page: 2, limit: 2 }, 5);

    expect(result).toEqual({
      data: ["a", "b"],
      pagination: { page: 2, limit: 2, total: 5, totalPages: 3 },
    });
  });

  it("totalPages nunca fica abaixo de 1, mesmo com total 0", () => {
    const result = paginate([], { page: 1, limit: 20 }, 0);

    expect(result.pagination.totalPages).toBe(1);
  });
});
