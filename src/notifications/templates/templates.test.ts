import { describe, expect, it } from "vitest";
import {
  emailVerificationTemplate,
  registrationConfirmationTemplate,
  passwordResetTemplate,
  passwordChangedTemplate,
  depositConfirmedTemplate,
  withdrawalRequestedTemplate,
  withdrawalApprovedTemplate,
  planPurchaseTemplate,
  planRenewalTemplate,
  supportTemplate,
} from "./index";

describe("templates de e-mail", () => {
  it("emailVerificationTemplate interpola a URL de verificação e não deixa subject/html vazios", () => {
    const result = emailVerificationTemplate({ verificationUrl: "https://api.example.com/email/verify/tok123" });

    expect(result.subject).toBeTruthy();
    expect(result.html).toContain("https://api.example.com/email/verify/tok123");
  });

  it("registrationConfirmationTemplate interpola o nome do usuário", () => {
    const result = registrationConfirmationTemplate({ name: "Maria" });

    expect(result.html).toContain("Maria");
  });

  it("passwordResetTemplate interpola a URL de redefinição", () => {
    const result = passwordResetTemplate({ resetUrl: "https://api.example.com/reset/tok456" });

    expect(result.html).toContain("https://api.example.com/reset/tok456");
  });

  it("passwordChangedTemplate interpola o nome do usuário", () => {
    const result = passwordChangedTemplate({ name: "João" });

    expect(result.html).toContain("João");
  });

  it("depositConfirmedTemplate interpola o valor do depósito", () => {
    const result = depositConfirmedTemplate({ amount: "R$ 150,00" });

    expect(result.html).toContain("R$ 150,00");
  });

  it("withdrawalRequestedTemplate interpola o valor do saque", () => {
    const result = withdrawalRequestedTemplate({ amount: "R$ 80,00" });

    expect(result.html).toContain("R$ 80,00");
  });

  it("withdrawalApprovedTemplate interpola o valor do saque", () => {
    const result = withdrawalApprovedTemplate({ amount: "R$ 80,00" });

    expect(result.html).toContain("R$ 80,00");
  });

  it("planPurchaseTemplate interpola o nome do plano", () => {
    const result = planPurchaseTemplate({ planName: "Plano Ouro" });

    expect(result.html).toContain("Plano Ouro");
  });

  it("planRenewalTemplate interpola o nome do plano", () => {
    const result = planRenewalTemplate({ planName: "Plano Ouro" });

    expect(result.html).toContain("Plano Ouro");
  });

  it("supportTemplate usa o subject e a mensagem informados", () => {
    const result = supportTemplate({ subject: "Dúvida sobre saque", message: "Segue o detalhe do meu problema." });

    expect(result.subject).toBe("Dúvida sobre saque");
    expect(result.html).toContain("Segue o detalhe do meu problema.");
  });
});
