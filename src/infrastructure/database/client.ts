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
