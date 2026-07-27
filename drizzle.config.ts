import { defineConfig } from "drizzle-kit";
import { env } from "./src/config/env";

// Schema e migrations são criados na Fase 2 (Banco de dados & Ledger).
export default defineConfig({
  dialect: "mysql",
  // Extglob `!(*.test)` exclui os testes que vivem ao lado do schema (ex.: `roles.test.ts`) — sem
  // isso o `drizzle-kit generate` tenta importar o arquivo de teste e quebra tentando carregar
  // `vitest` via `require()`. `drizzle-kit` resolve isso com o pacote `glob` clássico (via minimatch,
  // que suporta extglob por padrão), não com globs `!prefixados` num array — testado e confirmado.
  schema: "./src/infrastructure/database/schema/!(*.test).ts",
  out: "./src/infrastructure/database/migrations",
  dbCredentials: {
    host: env.DB_HOST,
    port: env.DB_PORT,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    database: env.DB_DATABASE,
  },
});
