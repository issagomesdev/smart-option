import { describe, expect, it, vi } from "vitest";

vi.mock("./resend-http-client", () => ({
  resendHttpClient: { post: vi.fn() },
}));

vi.mock("../shared/retry", () => ({
  withRetry: (fn: () => unknown) => fn(),
}));

import { resendHttpClient } from "./resend-http-client";
import { ResendProvider } from "./resend.provider";
import { ExternalServiceError } from "../../../shared/errors";

describe("ResendProvider", () => {
  it("envia o e-mail via POST /emails com o remetente montado a partir de MAIL_FROM_NAME/MAIL_FROM_ADDRESS", async () => {
    vi.mocked(resendHttpClient.post).mockResolvedValue({ data: { id: "email_123" } });

    const provider = new ResendProvider();
    const result = await provider.send({ to: "user@example.com", subject: "Assunto", html: "<p>Corpo</p>" });

    expect(resendHttpClient.post).toHaveBeenCalledWith("/emails", {
      from: "Smart Option <smart-option@example.com>",
      to: "user@example.com",
      subject: "Assunto",
      html: "<p>Corpo</p>",
    });
    expect(result).toEqual({ provider: "resend", messageId: "email_123" });
  });

  it("traduz falha HTTP em ExternalServiceError", async () => {
    vi.mocked(resendHttpClient.post).mockRejectedValue(new Error("network down"));

    const provider = new ResendProvider();

    await expect(
      provider.send({ to: "user@example.com", subject: "Assunto", html: "<p>Corpo</p>" }),
    ).rejects.toBeInstanceOf(ExternalServiceError);
  });
});
