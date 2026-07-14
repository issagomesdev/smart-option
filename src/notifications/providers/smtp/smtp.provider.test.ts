import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("./smtp-transport", () => ({
  smtpTransport: { sendMail: vi.fn() },
}));

vi.mock("../shared/retry", () => ({
  withRetry: (fn: () => unknown) => fn(),
}));

import { env } from "../../../config/env";
import { smtpTransport } from "./smtp-transport";
import { SmtpProvider } from "./smtp.provider";
import { ExternalServiceError } from "../../../shared/errors";

describe("SmtpProvider", () => {
  const originalSmtpUser = env.SMTP_USER;

  afterEach(() => {
    env.SMTP_USER = originalSmtpUser;
  });

  it("envia o e-mail com o remetente montado a partir de MAIL_FROM_NAME + SMTP_USER", async () => {
    env.SMTP_USER = "smtp-user@example.com";
    vi.mocked(smtpTransport.sendMail).mockResolvedValue({ messageId: "msg_123" } as Awaited<ReturnType<typeof smtpTransport.sendMail>>);

    const provider = new SmtpProvider();
    const result = await provider.send({ to: "user@example.com", subject: "Assunto", html: "<p>Corpo</p>" });

    expect(smtpTransport.sendMail).toHaveBeenCalledWith({
      from: "Smart Option <smtp-user@example.com>",
      to: "user@example.com",
      subject: "Assunto",
      html: "<p>Corpo</p>",
    });
    expect(result).toEqual({ provider: "smtp", messageId: "msg_123" });
  });

  it("traduz falha de envio em ExternalServiceError", async () => {
    vi.mocked(smtpTransport.sendMail).mockRejectedValue(new Error("connection refused"));

    const provider = new SmtpProvider();

    await expect(
      provider.send({ to: "user@example.com", subject: "Assunto", html: "<p>Corpo</p>" }),
    ).rejects.toBeInstanceOf(ExternalServiceError);
  });
});
