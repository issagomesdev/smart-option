import { describe, expect, it } from "vitest";
import { envSchema } from "./env";

const validEnv = {
  API_BASE_PATH: "http://localhost:3000",
  DB_HOST: "localhost",
  DB_USER: "root",
  DB_DATABASE: "smart_option",
  SECRET_KEY: "a-secret-key-with-enough-length",
  JWT_REFRESH_SECRET: "another-secret-with-enough-length",
  BOT_TOKEN: "123:abc",
  BOT_USER: "smart_option_bot",
  ASAAS_API_KEY: "test-asaas-api-key",
  ASAAS_BASE_URL: "https://sandbox.asaas.com/api/v3",
  ASAAS_WEBHOOK_TOKEN: "test-asaas-webhook-token",
  RESEND_API_KEY: "re_test_api_key",
  MAIL_FROM_NAME: "Smart Option",
  MAIL_FROM_ADDRESS: "smart-option@example.com",
};

describe("schema de variáveis de ambiente", () => {
  it("aceita uma configuração válida e aplica os defaults", () => {
    const result = envSchema.safeParse(validEnv);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.APP_PORT).toBe(3000);
      expect(result.data.NODE_ENV).toBe("development");
      expect(result.data.LOG_LEVEL).toBe("info");
    }
  });

  const requiredKeys = Object.keys(validEnv) as (keyof typeof validEnv)[];

  it.each(requiredKeys)("rejeita quando %s está ausente", (missingKey) => {
    const incomplete = { ...validEnv };
    delete incomplete[missingKey];

    const result = envSchema.safeParse(incomplete);

    expect(result.success).toBe(false);
  });

  it("rejeita SECRET_KEY curto demais", () => {
    const result = envSchema.safeParse({ ...validEnv, SECRET_KEY: "curto" });

    expect(result.success).toBe(false);
  });

  it("transforma CORS_ALLOWED_ORIGINS em uma lista sem espaços", () => {
    const result = envSchema.safeParse({ ...validEnv, CORS_ALLOWED_ORIGINS: "http://a.com, http://b.com" });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.CORS_ALLOWED_ORIGINS).toEqual(["http://a.com", "http://b.com"]);
    }
  });

  describe("EMAIL_TYPE", () => {
    it("com EMAIL_TYPE=resend (padrão), exige RESEND_API_KEY/MAIL_FROM_NAME/MAIL_FROM_ADDRESS", () => {
      const { RESEND_API_KEY, ...withoutResendKey } = validEnv;
      void RESEND_API_KEY;

      expect(envSchema.safeParse(validEnv).success).toBe(true);
      expect(envSchema.safeParse(withoutResendKey).success).toBe(false);
    });

    it("com EMAIL_TYPE=smtp, exige SMTP_HOST/SMTP_USER/SMTP_PASSWORD e não exige campos do Resend", () => {
      const { RESEND_API_KEY, MAIL_FROM_NAME, MAIL_FROM_ADDRESS, ...base } = validEnv;
      void RESEND_API_KEY;
      void MAIL_FROM_NAME;
      void MAIL_FROM_ADDRESS;

      const withoutSmtp = { ...base, EMAIL_TYPE: "smtp" };
      expect(envSchema.safeParse(withoutSmtp).success).toBe(false);

      const withSmtp = {
        ...base,
        EMAIL_TYPE: "smtp",
        SMTP_HOST: "smtp.test.local",
        SMTP_USER: "test@example.com",
        SMTP_PASSWORD: "test-smtp-password",
      };
      const result = envSchema.safeParse(withSmtp);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.SMTP_PORT).toBe(465);
      }
    });
  });
});
