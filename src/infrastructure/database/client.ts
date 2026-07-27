import mysql from "mysql2/promise";
import { drizzle } from "drizzle-orm/mysql2";
import { sql } from "drizzle-orm";
import { env } from "../../config/env";
import { logger } from "../../shared/logger";
import * as schema from "./schema";

/**
 * Pool dedicado ao cliente Drizzle. Coexiste, por enquanto, com o pool
 * legado em `src/db/index.ts` usado pelos services ainda não migrados —
 * os dois serão unificados na Fase 4, quando cada service passar a
 * consumir esta conexão em vez de SQL cru.
 */
export const pool = mysql.createPool({
  host: env.DB_HOST,
  port: env.DB_PORT,
  user: env.DB_USER,
  password: env.DB_PASSWORD,
  database: env.DB_DATABASE,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  // Sem isso, o driver serializa objetos `Date` do JS usando os campos de horário LOCAL do processo
  // Node (ex.: meia-noite em -03:00 vira o literal "00:00:00", sem o offset) — como a sessão do
  // MySQL roda em UTC (`@@session.time_zone = 'SYSTEM'`, servidor em UTC), esse literal é
  // reinterpretado como UTC, introduzindo um desvio de 3h em toda comparação `gte`/`lte`/`eq` contra
  // uma coluna `timestamp` (confirmado empiricamente: `TIMESTAMPDIFF(SECOND, jsDate, NOW())` batia
  // 10799s de diferença sem esta opção, 0s com ela). `timezone: "Z"` faz o driver converter o `Date`
  // para o instante UTC real antes de serializar, o que bate com o fuso real da sessão.
  timezone: "Z",
});

export const db = drizzle(pool, { schema, mode: "default" });

export async function checkDatabaseConnection(): Promise<boolean> {
  try {
    await db.execute(sql`SELECT 1`);
    return true;
  } catch (err) {
    logger.error({ err }, "Falha no healthcheck do banco de dados");
    return false;
  }
}
