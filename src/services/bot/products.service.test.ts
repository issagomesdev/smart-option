import { describe, expect, it } from "vitest";
import { ProductsService } from "./products.service";

/**
 * Catálogo de planos consumido pelo bot do Telegram — sempre semeado
 * (`scripts/seed.ts`, 6 produtos com id fixo, `cron.ts` referencia
 * `product_id` 3 e 4 diretamente). Sem `beforeAll`/`afterAll`: este teste só
 * lê, nunca escreve.
 */
describe("ProductsService.products (integração, banco real)", () => {
  it("devolve o catálogo semeado com o formato esperado", async () => {
    const result = await ProductsService.products();

    expect(result.length).toBeGreaterThanOrEqual(6);
    for (const product of result) {
      expect(product).toMatchObject({
        id: expect.any(Number),
        name: expect.any(String),
        description: expect.any(String),
        purchaseType: expect.stringMatching(/^(auto|manual)$/),
      });
    }
  });
});
