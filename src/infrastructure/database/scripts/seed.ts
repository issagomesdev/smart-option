import "../../../config/env";
import { db, pool } from "../client";
import { staffUsers } from "../schema";
import { logger } from "../../../shared/logger";
import { seedPlans } from "../seeds/plans.seed";

/**
 * Bootstrap de uma instalação nova: catálogo de planos + a conta admin original. O catálogo em si
 * mora em `../seeds/plans.seed.ts` (fonte única, reaproveitada por `npm run plans:seed` e pelo reset
 * do ambiente demo) — aqui só orquestramos.
 */
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
  const planCount = await seedPlans();
  logger.info({ count: planCount }, "Catálogo de produtos semeado");

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
