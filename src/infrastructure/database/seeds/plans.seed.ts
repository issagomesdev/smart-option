import { db } from "../client";
import { products } from "../schema";

/**
 * Catálogo de planos padrão — fonte única, permanente e INDEPENDENTE do modo demonstração. Todo
 * sistema recém-instalado precisa destes planos para funcionar; por isso vive aqui (dado versionado)
 * e não num seeder de demonstração.
 *
 * Os IDs são fixos de propósito e fazem parte do contrato: `src/server/cron.ts:141-143` referencia
 * o produto 3 (gold) e o 4 (diamond) diretamente na promoção/rebaixamento automático de tier.
 * Reordenar ou reaproveitar IDs quebra essa rotina — e é por isso que todos entram com
 * `isSystem: true`, o que o CRUD de planos usa para recusar exclusão (`PlansService.delete`).
 */
export const PRODUCTS_SEED = [
  {
    id: 1,
    name: "bronze",
    description:
      "  🥉Smart Bronze (até 4% ao mês) – R$ 97,00\n\n  Bônus de ADESÃO (Ilimitado)\n  ╔═════════╗\n  ║ Nível 1- 30% \n  ║ Nível 2- 7%     ╠ 40% 💵\n  ║ Nível 3- 3%  \n  ╚═════════╝\n  \n  Bônus de RENTABILIDADE (até 3 afiliados por nível)\n  ╔═════════════════╗\n  ║ Nível 1- (2,33% * 3) = 7%  \n  ║ Nível 2- (1,66% * 3) = 5%     ╠ 15% 💵\n  ║ Nível 3- (1,00% * 3) = 3%   \n  ╚═════════════════╝",
    price: "97.00",
    earningsMonthly: "4.00",
    purchaseType: "auto" as const,
  },
  {
    id: 2,
    name: "silver",
    description:
      "  🥈Smart Silver (até 6% ao mês) – R$ 197,00\r\n\r\n  Bônus de ADESÃO (Ilimitado)\r\n  ╔═════════╗\r\n  ║ Nível 1- 33%  \r\n  ║ Nível 2- 8%     ╠ 45% 💵\r\n  ║ Nível 3- 4% \r\n  ╚═════════╝\r\n  \r\n  Bônus de RENTABILIDADE (até 3 afiliados por nível)\r\n  ╔═════════════════╗\r\n  ║ Nível 1- (3,33% * 3) = 9%  \r\n  ║ Nível 2- (2,33% * 3) = 7%     ╠ 20% 💵\r\n  ║ Nível 3- (1,33% * 3) = 4%   \r\n  ╚═════════════════╝",
    price: "197.00",
    earningsMonthly: "6.00",
    purchaseType: "auto" as const,
  },
  {
    id: 3,
    name: "gold",
    description:
      "  🥇Smart Gold (até 8% ao mês) – R$ 297,00\r\n\r\n  Bônus de ADESÃO (Ilimitado)\r\n  ╔═════════╗\r\n  ║ Nível 1 - 35%  \r\n  ║ Nível 2 - 10%  ╠ 50% 💵\r\n  ║ Nível 3 - 5%  \r\n  ╚═════════╝\r\n  \r\n  Bônus de RENTABILIDADE (até 3 afiliados por nível)\r\n  ╔═════════════════╗\r\n  ║ Nível 1- (4,00% * 3) = 12%  \r\n  ║ Nível 2- (2,66% * 3) = 8%     ╠ 25% 💵\r\n  ║ Nível 3- (1,66% * 3) = 5%   \r\n  ╚═════════════════╝",
    price: "297.00",
    earningsMonthly: "8.00",
    purchaseType: "auto" as const,
  },
  {
    id: 4,
    name: "diamond",
    description:
      "  💎Smart Diamond (até 8% ao mês) – R$ 297,00\r\n\r\n  Bônus de ADESÃO (Ilimitado)\r\n  ╔═════════╗\r\n  ║ Nível 1 - 35%  \r\n  ║ Nível 2 - 10%  ╠ 50% 💵\r\n  ║ Nível 3 - 5%  \r\n  ╚═════════╝\r\n  \r\n  Bônus de RENTABILIDADE (até 3 afiliados por nível)\r\n  ╔═════════════════╗\r\n  ║ Nível 1- (4,00% * 3) = 12%  \r\n  ║ Nível 2- (2,66% * 3) = 8%     ╠ 25% 💵\r\n  ║ Nível 3- (1,66% * 3) = 5%   \r\n  ╚═════════════════╝",
    price: "297.00",
    earningsMonthly: "8.00",
    purchaseType: "auto" as const,
  },
  {
    id: 5,
    name: "🤖 Smart Bot",
    description:
      "  🤖 Smart Bot – R$397,00 (MENSAL)\r\n  Smart Bot – R$4.699,00 (VITALÍCIO)\r\n  • Gerenciamento avançado.\r\n  • Analisa mais de 17 estratégias e\r\n  encontra as melhores oportunidades.\r\n  • Operações automatizadas.\r\n  • Opera no mercado aberto e OTC.\r\n  • Stop WIN/LOSS.\r\n  • Martin Gale e Soros.\r\n  • Mais de 90% de assertividade.",
    price: "0.00",
    earningsMonthly: "0.00",
    purchaseType: "manual" as const,
  },
  {
    id: 6,
    name: "🎰 Alavancagem de banca",
    description:
      "  🎰 Alavancagem de banca:\n  \n  Aumente em até 5 vezes o valor de sua\n  banca em uma sessão individual com um\n  Trader de nossa equipe.\n\n  *Embora nossa Equipe tenha um\n  histórico de êxito nas operações,\n  o mercado de renda variável não\n  possibilita garantias que ganhos\n  passados representarão resultados\n  futuros.",
    price: "0.00",
    earningsMonthly: "0.00",
    purchaseType: "manual" as const,
  },
];

/**
 * Upsert idempotente: pode rodar quantas vezes for preciso (instalação nova, `npm run plans:seed`,
 * ou no fim de cada `npm run demo:reset`) sempre convergindo para o mesmo catálogo.
 */
export async function seedPlans(): Promise<number> {
  for (const product of PRODUCTS_SEED) {
    await db
      .insert(products)
      .values({ ...product, isSystem: true })
      .onDuplicateKeyUpdate({
        set: {
          name: product.name,
          description: product.description,
          price: product.price,
          earningsMonthly: product.earningsMonthly,
          purchaseType: product.purchaseType,
          isSystem: true,
        },
      });
  }

  return PRODUCTS_SEED.length;
}
