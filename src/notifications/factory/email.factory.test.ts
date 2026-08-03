import { afterEach, describe, expect, it, vi } from "vitest";

describe("getEmailProvider", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("retorna uma instância de ResendProvider por padrão (EMAIL_TYPE=resend)", async () => {
    const { getEmailProvider } = await import("./email.factory");
    const { ResendProvider } = await import("../providers/resend/resend.provider");

    expect(getEmailProvider()).toBeInstanceOf(ResendProvider);
  });

  it("retorna sempre a mesma instância (singleton)", async () => {
    const { getEmailProvider } = await import("./email.factory");

    expect(getEmailProvider()).toBe(getEmailProvider());
  });

  it("embrulha o provedor real no filtro da demonstração quando APP_DEMO=true", async () => {
    vi.stubEnv("APP_DEMO", "true");
    vi.resetModules();

    const { getEmailProvider } = await import("./email.factory");
    const { DemoEmailProvider } = await import("../providers/demo/demo.provider");

    // Embrulha, não substitui: o e-mail de um visitante real continua saindo pela Resend/SMTP —
    // só os endereços fictícios do seeder são descartados (ver `demo.provider.test.ts`).
    expect(getEmailProvider()).toBeInstanceOf(DemoEmailProvider);
  });

  it("retorna uma instância de SmtpProvider quando EMAIL_TYPE=smtp", async () => {
    vi.stubEnv("EMAIL_TYPE", "smtp");
    vi.stubEnv("SMTP_HOST", "smtp.test.local");
    vi.stubEnv("SMTP_USER", "test@example.com");
    vi.stubEnv("SMTP_PASSWORD", "test-smtp-password");
    vi.resetModules();

    const { getEmailProvider } = await import("./email.factory");
    const { SmtpProvider } = await import("../providers/smtp/smtp.provider");

    expect(getEmailProvider()).toBeInstanceOf(SmtpProvider);
  });
});
