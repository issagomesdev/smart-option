import { defineConfig } from "drizzle-kit";
import { env } from "./src/config/env";

// Schema e migrations são criados na Fase 2 (Banco de dados & Ledger).
export default defineConfig({
  dialect: "mysql",
  schema: "./src/infrastructure/database/schema/*.ts",
  out: "./src/infrastructure/database/migrations",
  dbCredentials: {
    host: env.DB_HOST,
    port: env.DB_PORT,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    database: env.DB_DATABASE,
  },
});
