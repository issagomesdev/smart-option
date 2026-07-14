import { describe, expect, it, vi } from "vitest";

vi.mock("../../shared/logger", () => ({
  logger: { info: vi.fn(), error: vi.fn() },
}));

import { logger } from "../../shared/logger";
import { NotificationService } from "./notification.service";
import { EmailProvider, EmailSendResult } from "../interfaces/email.provider";

function fakeProvider(result: EmailSendResult): EmailProvider {
  return { send: vi.fn().mockResolvedValue(result) };
}

function failingProvider(error: Error): EmailProvider {
  return { send: vi.fn().mockRejectedValue(error) };
}

describe("NotificationService", () => {
  it("sendEmailVerification monta o template e envia via provider", async () => {
    const provider = fakeProvider({ provider: "resend", messageId: "msg_1" });
    const service = new NotificationService(provider);

    await service.sendEmailVerification({ to: "user@example.com", verificationUrl: "https://api.example.com/verify/tok" });

    expect(provider.send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "user@example.com",
        subject: expect.any(String),
        html: expect.stringContaining("https://api.example.com/verify/tok"),
      }),
    );
  });

  it.each([
    ["sendRegistrationConfirmation", { name: "Maria" }],
    ["sendPasswordReset", { resetUrl: "https://api.example.com/reset/tok" }],
    ["sendPasswordChanged", { name: "João" }],
    ["sendDepositConfirmed", { amount: "R$ 100,00" }],
    ["sendWithdrawalRequested", { amount: "R$ 50,00" }],
    ["sendWithdrawalApproved", { amount: "R$ 50,00" }],
    ["sendPlanPurchase", { planName: "Plano Ouro" }],
    ["sendPlanRenewal", { planName: "Plano Ouro" }],
    ["sendSupport", { subject: "Dúvida", message: "Mensagem de suporte" }],
  ] as const)("%s chama o provider com to/subject/html preenchidos", async (method, extra) => {
    const provider = fakeProvider({ provider: "resend", messageId: "msg_1" });
    const service = new NotificationService(provider);

    await (service as any)[method]({ to: "user@example.com", ...extra });

    expect(provider.send).toHaveBeenCalledWith(
      expect.objectContaining({ to: "user@example.com", subject: expect.any(String), html: expect.any(String) }),
    );
  });

  it("loga sucesso com destinatário, provider e duração — sem vazar o corpo do e-mail", async () => {
    const provider = fakeProvider({ provider: "resend", messageId: "msg_1" });
    const service = new NotificationService(provider);

    await service.sendEmailVerification({ to: "user@example.com", verificationUrl: "https://api.example.com/verify/tok-secreto" });

    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({ to: "user@example.com", provider: "resend", durationMs: expect.any(Number) }),
      expect.any(String),
    );

    const loggedPayload = vi.mocked(logger.info).mock.calls[0][0];
    expect(JSON.stringify(loggedPayload)).not.toContain("tok-secreto");
  });

  it("loga falha e propaga o erro quando o provider rejeita", async () => {
    const provider = failingProvider(new Error("falha simulada"));
    const service = new NotificationService(provider);

    await expect(
      service.sendEmailVerification({ to: "user@example.com", verificationUrl: "https://api.example.com/verify/tok" }),
    ).rejects.toThrow("falha simulada");

    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ to: "user@example.com", durationMs: expect.any(Number) }),
      expect.any(String),
    );
  });
});
