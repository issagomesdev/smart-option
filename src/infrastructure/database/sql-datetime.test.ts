import { describe, expect, it } from "vitest";
import { parseSqlDateTime } from "./sql-datetime";

describe("parseSqlDateTime", () => {
  it("reconstrói o instante UTC correto a partir do formato bruto do mysql2 ('YYYY-MM-DD HH:mm:ss')", () => {
    const result = parseSqlDateTime("2026-03-15 14:30:00");
    expect(result.toISOString()).toBe("2026-03-15T14:30:00.000Z");
  });

  it("preserva frações de segundo quando presentes", () => {
    const result = parseSqlDateTime("2026-03-15 14:30:00.123");
    expect(result.toISOString()).toBe("2026-03-15T14:30:00.123Z");
  });
});
