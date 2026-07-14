import "../../../config/env";
import { db, pool } from "../client";
import { products, staffUsers } from "../schema";
import { logger } from "../../../shared/logger";

/**
 * Dados de configuração que existiam como INSERTs fixos em `src/db/base.sql`
 * (o antigo mecanismo de bootstrap do banco, agora substituído pelas
 * migrations do Drizzle). Não é dado de usuário/transação — é catálogo e a
 * conta admin original — por isso faz sentido preservar via seed versionado
 * em vez de descartar.
 *
 * IDs de produto são fixos de propósito: `src/server/cron.ts` (não migrado
 * nesta fase) referencia `product_id` 3 (gold) e 4 (diamond) diretamente.
 * Reordenar os IDs quebraria a promoção/rebaixamento automático de tier.
 */
const PRODUCTS_SEED = [
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

const STAFF_USERS_SEED = [
  {
    id: 1,
    name: "sr",
    surname: "admin",
    email: "admin@admin.com",
    // Hash SHA1 herdado do base.sql. Continua inseguro até a Fase 6
    // (rotação para um hash forte é feita junto da reescrita do módulo de auth).
    password: "5baa61e4c9b93f3f0682250b6cf8331b7ee68fd8",
    roleId: 1,
  },
];

async function seed(): Promise<void> {
  for (const product of PRODUCTS_SEED) {
    await db
      .insert(products)
      .values(product)
      .onDuplicateKeyUpdate({
        set: {
          name: product.name,
          description: product.description,
          price: product.price,
          earningsMonthly: product.earningsMonthly,
          purchaseType: product.purchaseType,
        },
      });
  }
  logger.info({ count: PRODUCTS_SEED.length }, "Catálogo de produtos semeado");

  for (const user of STAFF_USERS_SEED) {
    await db
      .insert(staffUsers)
      .values(user)
      .onDuplicateKeyUpdate({ set: { name: user.name, surname: user.surname } });
  }
  logger.info({ count: STAFF_USERS_SEED.length }, "Usuários admin semeados");
}

seed()
  .then(async () => {
    await pool.end();
    process.exit(0);
  })
  .catch(async (err) => {
    logger.error({ err }, "Falha ao semear o banco de dados");
    await pool.end();
    process.exit(1);
  });
