import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

export const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_PORT: z.coerce.number().int().positive().default(3000),
  API_BASE_PATH: z.string().min(1, "API_BASE_PATH é obrigatório"),

  DB_HOST: z.string().min(1, "DB_HOST é obrigatório"),
  DB_PORT: z.coerce.number().int().positive().default(3306),
  DB_USER: z.string().min(1, "DB_USER é obrigatório"),
  DB_PASSWORD: z.string().default(""),
  DB_DATABASE: z.string().min(1, "DB_DATABASE é obrigatório"),

  SECRET_KEY: z.string().min(16, "SECRET_KEY deve ter pelo menos 16 caracteres"),
  JWT_ACCESS_EXPIRES_IN: z.string().default("15m"),
  JWT_REFRESH_SECRET: z.string().min(16, "JWT_REFRESH_SECRET deve ter pelo menos 16 caracteres"),
  JWT_REFRESH_EXPIRES_IN: z.string().default("30d"),

  BOT_TOKEN: z.string().min(1, "BOT_TOKEN é obrigatório"),
  BOT_USER: z.string().min(1, "BOT_USER é obrigatório"),

  REDIS_URL: z.url().default("redis://localhost:6379"),

  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),

  CORS_ALLOWED_ORIGINS: z
    .string()
    .default("")
    .transform((value) =>
      value
        .split(",")
        .map((origin) => origin.trim())
        .filter(Boolean),
    ),

  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(15 * 60 * 1000),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(300),

  // Puramente informativo hoje (não deriva ASAAS_BASE_URL automaticamente) —
  // documenta qual ambiente da Asaas o ASAAS_API_KEY/ASAAS_BASE_URL abaixo
  // realmente apontam, já que os dois precisam mudar juntos ao trocar de ambiente.
  ASAAS_ENV: z.enum(["sandbox", "production"]).default("sandbox"),
  ASAAS_API_KEY: z.string().min(1, "ASAAS_API_KEY é obrigatório"),
  ASAAS_BASE_URL: z.url(),
  ASAAS_WEBHOOK_TOKEN: z.string().min(16, "ASAAS_WEBHOOK_TOKEN deve ter pelo menos 16 caracteres"),

  // --- Cloudflare Tunnel (apenas desenvolvimento local — expõe a API sob um
  // subdomínio fixo de example.url para receber webhooks reais da Asaas sem
  // depender de deploy. Túnel nomeado/persistente, nunca o modo `--url`
  // efêmero do cloudflared — ver docs/README, seção Cloudflare Tunnel) ------
  // ID do túnel nomeado (`cloudflared tunnel create <nome>` imprime isto).
  CF_TUNNEL_ID: z.string().default(""),
  // Token do túnel (alternativa ao arquivo de credenciais — `cloudflared
  // tunnel token <nome>`). Vazio = usa o arquivo de credenciais em cloudflared/.
  CF_TUNNEL_TOKEN: z.string().default(""),
  // Subdomínio público do túnel — dev usa so.example.url, produção usa
  // api.example.url (a única diferença entre os dois ambientes é esta env var).
  CF_TUNNEL_DOMAIN: z.string().default("so.example.url"),
  // Host para onde o cloudflared encaminha as requisições — "localhost" se o
  // cloudflared roda no host, ou o nome do serviço Docker (ex.: "app") se
  // roda no mesmo compose.
  CF_TUNNEL_HOST: z.string().default("localhost"),

  // E-mail (módulo `notifications/`) — provedor escolhido exclusivamente por
  // EMAIL_TYPE, nunca por condicional espalhada pelo código. Resend é o
  // padrão (API HTTP); SMTP é a alternativa configurável. Os campos de
  // credencial de cada provedor são opcionais no schema base e só viram
  // obrigatórios no branch correspondente, validado abaixo em `superRefine`.
  EMAIL_TYPE: z.enum(["resend", "smtp"]).default("resend"),

  RESEND_API_KEY: z.string().optional(),
  MAIL_FROM_NAME: z.string().optional(),
  MAIL_FROM_ADDRESS: z.email("MAIL_FROM_ADDRESS deve ser um e-mail válido").optional(),

  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().default(465),
  SMTP_USER: z.email("SMTP_USER deve ser um e-mail válido").optional(),
  SMTP_PASSWORD: z.string().optional(),
}).superRefine((data, ctx) => {
  if (data.EMAIL_TYPE === "resend") {
    if (!data.RESEND_API_KEY) {
      ctx.addIssue({ code: "custom", path: ["RESEND_API_KEY"], message: "RESEND_API_KEY é obrigatório quando EMAIL_TYPE=resend" });
    }
    if (!data.MAIL_FROM_NAME) {
      ctx.addIssue({ code: "custom", path: ["MAIL_FROM_NAME"], message: "MAIL_FROM_NAME é obrigatório quando EMAIL_TYPE=resend" });
    }
    if (!data.MAIL_FROM_ADDRESS) {
      ctx.addIssue({ code: "custom", path: ["MAIL_FROM_ADDRESS"], message: "MAIL_FROM_ADDRESS é obrigatório quando EMAIL_TYPE=resend" });
    }
  } else {
    if (!data.SMTP_HOST) {
      ctx.addIssue({ code: "custom", path: ["SMTP_HOST"], message: "SMTP_HOST é obrigatório quando EMAIL_TYPE=smtp" });
    }
    if (!data.SMTP_USER) {
      ctx.addIssue({ code: "custom", path: ["SMTP_USER"], message: "SMTP_USER é obrigatório quando EMAIL_TYPE=smtp" });
    }
    if (!data.SMTP_PASSWORD) {
      ctx.addIssue({ code: "custom", path: ["SMTP_PASSWORD"], message: "SMTP_PASSWORD é obrigatório quando EMAIL_TYPE=smtp" });
    }
  }
});

export type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    console.error(`Configuração de ambiente inválida:\n${issues}`);
    process.exit(1);
  }

  return result.data;
}

export const env = loadEnv();
export const isProduction = env.NODE_ENV === "production";
export const isTest = env.NODE_ENV === "test";
