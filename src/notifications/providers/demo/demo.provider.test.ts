import { describe, expect, it, vi } from "vitest";
import { DemoEmailProvider } from "./demo.provider";
import type { EmailMessage, EmailProvider } from "../../interfaces/email.provider";

/**
 * O filtro é a única coisa entre a demonstração e uma leva de bounces: o seeder cria centenas de
 * contas `@exemplo.com.br`, e cada fluxo que dispara e-mail passaria por aqui. Ao mesmo tempo, ele
 * não pode barrar o endereço que um visitante digitou, senão o cadastro pelo bot trava — o login
 * exige e-mail validado e o link nunca chegaria.
 */
describe("DemoEmailProvider", () => {
  function build() {
    const send = vi.fn<EmailProvider["send"]>().mockResolvedValue({ provider: "resend", messageId: "real-1" });
    return { send, provider: new DemoEmailProvider({ send }) };
  }

  const message = (to: string): EmailMessage => ({ to, subject: "Confirme seu cadastro", html: "<p>ok</p>" });

  it("entrega ao provedor real quando o destinatário foi digitado por uma pessoa", async () => {
    const { send, provider } = build();

    const result = await provider.send(message("pessoa.real@gmail.com"));

    expect(send).toHaveBeenCalledWith(message("pessoa.real@gmail.com"));
    expect(result.messageId).toBe("real-1");
  });

  it("descarta quando o destinatário é um endereço fictício do seeder", async () => {
    const { send, provider } = build();

    const result = await provider.send(message("demo.42.1785270532865@exemplo.com.br"));

    expect(send).not.toHaveBeenCalled();
    // Devolve sucesso mesmo assim: quem chama não precisa saber que está em demonstração.
    expect(result.messageId).toMatch(/^demo-/);
  });

  it("reconhece o domínio fictício sem depender de caixa ou espaços em volta", async () => {
    const { send, provider } = build();

    await provider.send(message("  DEMO.7.123@Exemplo.Com.BR  "));

    expect(send).not.toHaveBeenCalled();
  });

  it("não confunde um domínio que apenas termina parecido com o fictício", async () => {
    const { send, provider } = build();

    // "naoexemplo.com.br" não é o domínio do seeder — a checagem é por "@dominio", não por sufixo solto.
    await provider.send(message("alguem@naoexemplo.com.br"));

    expect(send).toHaveBeenCalled();
  });

  it("propaga a falha do provedor real em vez de mascará-la como sucesso", async () => {
    const { send, provider } = build();
    send.mockRejectedValue(new Error("provedor fora do ar"));

    await expect(provider.send(message("pessoa.real@gmail.com"))).rejects.toThrow("provedor fora do ar");
  });
});
