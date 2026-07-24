import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: false,
    include: ["src/**/*.test.ts"],
    // Vários arquivos de teste agora abrem sua própria pool de conexão contra
    // o MySQL real de dev (cada arquivo roda num worker isolado) — sob carga
    // paralela, especialmente o teste de concorrência do WalletService
    // (20 débitos simultâneos disputando o mesmo lock de linha de propósito),
    // o timeout padrão de 5s é curto demais mesmo sem nenhum bug envolvido.
    testTimeout: 20000,
    // Arquivos de teste diferentes tocando as mesmas tabelas (`wallet`,
    // `wallet_transactions`) em paralelo, cada um em seu próprio worker/pool,
    // já produziu deadlock real do MySQL (`ER_LOCK_DEADLOCK`) durante a
    // limpeza de dados de um teste enquanto outro arquivo travava linhas da
    // mesma tabela ao mesmo tempo. Rodar os arquivos em sequência custa
    // alguns segundos a mais e elimina essa classe de flakiness.
    fileParallelism: false,
    env: {
      NODE_ENV: "test",
      API_BASE_PATH: "http://localhost:3000",
      // Aponta para o MySQL real do docker-compose.dev.yml (mesmas
      // credenciais de .env.development.example) — alguns testes de integração (ex.:
      // WalletService) precisam de uma transação de banco real para provar
      // `SELECT ... FOR UPDATE`/idempotência; testes que não tocam `db`
      // simplesmente nunca abrem conexão (pool do mysql2 é lazy).
      // DB_HOST/REDIS_URL usam o valor já presente em `process.env` quando
      // existir (achado real da Fase 24: dentro do container de dev,
      // `docker-compose.dev.yml` já injeta `DB_HOST=mysql`/
      // `REDIS_URL=redis://redis:6379` — os nomes de serviço da rede do
      // Compose, não alcançáveis por "localhost" de dentro do container).
      // Rodando fora do Docker (`npm test` direto no host), essas vars não
      // vêm pré-setadas, e caem no fallback "localhost", que é onde o
      // `docker-compose.dev.yml` expõe as portas do MySQL/Redis para o host.
      DB_HOST: process.env.DB_HOST ?? "localhost",
      DB_PORT: "3306",
      DB_USER: "smart_option",
      DB_PASSWORD: "smart_option",
      DB_DATABASE: "smart_option",
      SECRET_KEY: "test-secret-key-please-ignore",
      JWT_REFRESH_SECRET: "test-refresh-secret-please-ignore",
      BOT_TOKEN: "test-bot-token",
      BOT_USER: "test_bot",
      REDIS_URL: process.env.REDIS_URL ?? "redis://localhost:6379",
      ASAAS_API_KEY: "test-asaas-api-key",
      ASAAS_BASE_URL: "https://sandbox.asaas.com/api/v3",
      ASAAS_WEBHOOK_TOKEN: "test-asaas-webhook-token",
      // EMAIL_TYPE não é setado aqui de propósito — o default do schema
      // ("resend") é o que a suíte inteira carrega; testes que exercitam o
      // branch SMTP setam EMAIL_TYPE/SMTP_* pontualmente via vi.stubEnv.
      RESEND_API_KEY: "test-resend-api-key",
      MAIL_FROM_NAME: "Smart Option",
      MAIL_FROM_ADDRESS: "smart-option@example.com",
    },
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["src/**/*.ts"],
      // `src/bot/**`/`src/services/**` já foram excluídos daqui na Fase 1,
      // quando eram SQL cru legado sem teste nenhum — hoje são o código mais
      // testado do projeto (7 arquivos de teste em `services/`), e a
      // exclusão nunca foi revisada. Removida na Fase 6 (auditoria de
      // cobertura, achado real: escondia tanto boa cobertura quanto lacunas
      // reais desses diretórios).
      exclude: ["src/**/*.test.ts"],
    },
  },
});
