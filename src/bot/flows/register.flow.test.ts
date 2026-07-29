import TelegramBot from "node-telegram-bot-api";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const registerUser = vi.fn();
// `vi.hoisted`: a fábrica do `vi.mock` é içada acima das declarações do módulo e é executada na
// importação de `register.flow.ts`, antes de qualquer `const` de topo ser inicializado. As mensagens
// precisam existir nesse momento porque o mock as devolve como valor, não dentro de uma função.
const { EMAIL_TAKEN_MESSAGE, CPF_TAKEN_MESSAGE } = vi.hoisted(() => ({
  EMAIL_TAKEN_MESSAGE: "Este e-mail já está cadastrado. Faça login na sua conta ou informe outro e-mail para continuar o cadastro.",
  CPF_TAKEN_MESSAGE: "Este CPF já está cadastrado. Faça login na sua conta ou informe outro CPF para continuar o cadastro.",
}));
vi.mock("../../services/bot/register.service", () => ({
  RegisterService: { registerUser: (...args: unknown[]) => registerUser(...args) },
  EMAIL_TAKEN_MESSAGE,
  CPF_TAKEN_MESSAGE,
}));

import { sessionService, BotSession } from "../session.service";
import { ConflictError } from "../../shared/errors";
import * as registerFlow from "./register.flow";

const VALID_CPF = "52998224725";

/**
 * `register.flow.ts` é o assistente de cadastro campo-a-campo (nome → email
 * → senha → confirma senha → telefone → cpf → endereço → pix), com um modo
 * de correção pontual pós-revisão. `RegisterService.registerUser` é mockado
 * (já testado em `register.service.test.ts`); `sessionService` roda contra
 * o Redis real.
 */
describe("register.flow", () => {
  const stamp = Date.now();
  const userId = 932000000 + Number(String(stamp).slice(-6));
  const chatId = 1;

  function fakeBot(): TelegramBot {
    return { sendMessage: vi.fn().mockResolvedValue({}) } as unknown as TelegramBot;
  }

  function msg(text: string) {
    return { text, from: { id: userId }, chat: { id: chatId } } as any;
  }

  function query(data: string) {
    return { data, message: { chat: { id: chatId } }, from: { id: userId } } as any;
  }

  beforeEach(() => {
    registerUser.mockReset();
  });

  afterEach(async () => {
    await sessionService.clear(userId);
  });

  it("start entra no fluxo de cadastro e pergunta o primeiro campo (nome)", async () => {
    const bot = fakeBot();
    await registerFlow.start(bot, chatId, userId, 42);

    const session = await sessionService.get(userId);
    expect(session.flow).toBe("register");
    expect((session.data as any).affiliateId).toBe(42);
    expect(bot.sendMessage).toHaveBeenLastCalledWith(chatId, "Nome Completo:");
  });

  describe("handleMessage — coleta normal", () => {
    it("responde o campo atual e avança para o próximo", async () => {
      const bot = fakeBot();
      const session: BotSession = { flow: "register", step: "collecting", data: { answers: {}, currentField: 0, fieldCorrection: null, affiliateId: null } };

      await registerFlow.handleMessage(bot, msg("Fulano de Tal"), session);

      const next = await sessionService.get(userId);
      expect((next.data as any).currentField).toBe(1);
      expect((next.data as any).answers.name).toBe("Fulano de Tal");
      expect(bot.sendMessage).toHaveBeenLastCalledWith(chatId, "Email:");
    });

    it("CPF inválido: reprompta sem avançar o campo", async () => {
      const bot = fakeBot();
      const session: BotSession = {
        flow: "register",
        step: "collecting",
        data: { answers: {}, currentField: 5, fieldCorrection: null, affiliateId: null },
      };

      await registerFlow.handleMessage(bot, msg("11111111111"), session);

      // Campo inválido nunca chega a gravar sessão nova — nada muda no Redis.
      expect(await sessionService.get(userId)).toEqual({ flow: null, step: null, data: {} });
      expect(bot.sendMessage).toHaveBeenCalledWith(chatId, expect.stringContaining("CPF inválido"));
    });

    it("senhas não coincidem na coleta normal: volta para o campo de senha", async () => {
      const bot = fakeBot();
      const session: BotSession = {
        flow: "register",
        step: "collecting",
        data: { answers: { password: "abc123" }, currentField: 3, fieldCorrection: null, affiliateId: null },
      };

      await registerFlow.handleMessage(bot, msg("diferente"), session);

      const next = await sessionService.get(userId);
      expect((next.data as any).currentField).toBe(2);
      expect(bot.sendMessage).toHaveBeenCalledWith(chatId, expect.stringContaining("não coincidem"));
    });

    it("último campo (pix): move para confirmação e mostra o resumo", async () => {
      const bot = fakeBot();
      const answers = {
        name: "Fulano",
        email: "fulano@test.com",
        password: "senha123",
        confirm_password: "senha123",
        phone_number: "11900000000",
        cpf: VALID_CPF,
        adress: "Rua Teste, 1",
      };
      const session: BotSession = {
        flow: "register",
        step: "collecting",
        data: { answers, currentField: 7, fieldCorrection: null, affiliateId: null },
      };

      await registerFlow.handleMessage(bot, msg("chave-pix"), session);

      const next = await sessionService.get(userId);
      expect(next.step).toBe("confirm");
      expect(bot.sendMessage).toHaveBeenCalledWith(chatId, "Confirma?", expect.anything());
    });

    it("ignora mensagens de texto soltas enquanto aguarda callback de confirmação", async () => {
      const bot = fakeBot();
      const session: BotSession = { flow: "register", step: "confirm", data: { answers: {}, currentField: 7, fieldCorrection: null, affiliateId: null } };
      await sessionService.set(userId, session);

      await registerFlow.handleMessage(bot, msg("qualquer coisa"), session);

      expect(bot.sendMessage).not.toHaveBeenCalled();
      expect(await sessionService.get(userId)).toEqual(session);
    });
  });

  describe("handleMessage — correção pontual", () => {
    it("corrigindo um campo comum: grava, sai do modo correção e volta para a confirmação", async () => {
      const bot = fakeBot();
      const answers = { name: "Nome Antigo", email: "old@test.com" };
      const session: BotSession = {
        flow: "register",
        step: "collecting",
        data: { answers, currentField: 7, fieldCorrection: 0, affiliateId: null },
      };

      await registerFlow.handleMessage(bot, msg("Nome Novo"), session);

      const next = await sessionService.get(userId);
      expect(next.step).toBe("confirm");
      expect((next.data as any).fieldCorrection).toBeNull();
      expect((next.data as any).answers.name).toBe("Nome Novo");
    });

    it("corrigindo a senha: avança para o campo de confirmação de senha", async () => {
      const bot = fakeBot();
      const session: BotSession = {
        flow: "register",
        step: "collecting",
        data: { answers: {}, currentField: 7, fieldCorrection: 2, affiliateId: null },
      };

      await registerFlow.handleMessage(bot, msg("novaSenha"), session);

      const next = await sessionService.get(userId);
      expect((next.data as any).fieldCorrection).toBe(3);
      expect(bot.sendMessage).toHaveBeenLastCalledWith(chatId, "Confirme sua senha:");
    });

    it("corrigindo a confirmação de senha sem coincidir: volta para o campo de senha", async () => {
      const bot = fakeBot();
      const session: BotSession = {
        flow: "register",
        step: "collecting",
        data: { answers: { password: "senhaA" }, currentField: 7, fieldCorrection: 3, affiliateId: null },
      };

      await registerFlow.handleMessage(bot, msg("senhaB"), session);

      const next = await sessionService.get(userId);
      expect((next.data as any).fieldCorrection).toBe(2);
      expect(bot.sendMessage).toHaveBeenCalledWith(chatId, expect.stringContaining("não coincidem"));
    });
  });

  describe("handleCallback — confirm-user-infos", () => {
    const answers = {
      name: "Fulano",
      email: "fulano@test.com",
      password: "senha123",
      confirm_password: "senha123",
      phone_number: "11900000000",
      cpf: VALID_CPF,
      adress: "Rua Teste, 1",
      pix_code: "chave-pix",
    };
    const confirmSession: BotSession = { flow: "register", step: "confirm", data: { answers, currentField: 7, fieldCorrection: null, affiliateId: 9 } };

    it("sim + sucesso: registra o usuário e limpa a sessão", async () => {
      registerUser.mockResolvedValue({ status: true, message: "ok" });
      const bot = fakeBot();

      await registerFlow.handleCallback(bot, query("choice=yes&for=confirm-user-infos"), confirmSession);

      expect(registerUser).toHaveBeenCalledWith(answers, 9);
      expect(bot.sendMessage).toHaveBeenCalledWith(chatId, expect.stringContaining("sucesso"), expect.anything());
      expect(await sessionService.get(userId)).toEqual({ flow: null, step: null, data: {} });
    });

    it("sim + email já cadastrado: explica e leva à correção do campo email", async () => {
      registerUser.mockRejectedValue(new ConflictError(EMAIL_TAKEN_MESSAGE));
      const bot = fakeBot();

      await registerFlow.handleCallback(bot, query("choice=yes&for=confirm-user-infos"), confirmSession);

      const next = await sessionService.get(userId);
      expect(next.step).toBe("collecting");
      expect((next.data as any).fieldCorrection).toBe(1);
      expect(bot.sendMessage).toHaveBeenCalledWith(chatId, expect.stringContaining("Faça login"), expect.anything());
      expect(bot.sendMessage).toHaveBeenCalledWith(chatId, expect.stringContaining("Email"));
    });

    it("sim + CPF já cadastrado: explica e leva à correção do campo CPF", async () => {
      registerUser.mockRejectedValue(new ConflictError(CPF_TAKEN_MESSAGE));
      const bot = fakeBot();

      await registerFlow.handleCallback(bot, query("choice=yes&for=confirm-user-infos"), confirmSession);

      const next = await sessionService.get(userId);
      expect(next.step).toBe("collecting");
      expect((next.data as any).fieldCorrection).toBe(5);
      expect(bot.sendMessage).toHaveBeenCalledWith(chatId, expect.stringContaining("CPF"));
    });

    it("sim + erro do backend: mostra mensagem em português, nunca o erro cru, e devolve à confirmação", async () => {
      // Erro cru do driver, exatamente como o Drizzle propaga uma violação de chave única.
      registerUser.mockRejectedValue(new Error("Failed query: insert into `bot_users` ... params: fulano,f@x.com,$2b$12$hash"));
      const bot = fakeBot();

      await registerFlow.handleCallback(bot, query("choice=yes&for=confirm-user-infos"), confirmSession);

      const sent = (bot.sendMessage as any).mock.calls.map((call: unknown[]) => String(call[1])).join(" | ");
      expect(sent).toContain("suporte");
      expect(sent).not.toContain("Failed query");
      expect(sent).not.toContain("bot_users");
      expect(sent).not.toContain("$2b$12$");

      // Os dados digitados sobrevivem: o usuário pode tentar de novo sem redigitar tudo.
      const next = await sessionService.get(userId);
      expect(next.step).toBe("confirm");
      expect((next.data as any).answers).toEqual(answers);
    });

    it("sim clicado duas vezes: cadastra uma única vez (guarda contra duplo clique)", async () => {
      registerUser.mockResolvedValue({ status: true, message: "ok" });
      const bot = fakeBot();

      // O segundo callback chega com a sessão já marcada como "submitting" pelo primeiro — é
      // exatamente o que o dispatcher lê do Redis antes de repassar ao fluxo.
      await registerFlow.handleCallback(bot, query("choice=yes&for=confirm-user-infos"), confirmSession);
      await registerFlow.handleCallback(bot, query("choice=yes&for=confirm-user-infos"), {
        ...confirmSession,
        step: "submitting",
      });

      expect(registerUser).toHaveBeenCalledTimes(1);
    });

    it("não: mostra as opções de correção por campo", async () => {
      const bot = fakeBot();

      await registerFlow.handleCallback(bot, query("choice=no&for=confirm-user-infos"), confirmSession);

      expect(bot.sendMessage).toHaveBeenCalledWith(chatId, "Qual informação deseja corrigir?");
      expect(bot.sendMessage).toHaveBeenCalledWith(chatId, "Tudo", expect.anything());
    });
  });

  describe("handleCallback — correction-user-infos", () => {
    const answers = { name: "Fulano" };
    const session: BotSession = { flow: "register", step: "confirm", data: { answers, currentField: 7, fieldCorrection: null, affiliateId: 9 } };

    it("all: reseta os dados e reinicia a coleta do zero", async () => {
      const bot = fakeBot();

      await registerFlow.handleCallback(bot, query("choice=all&for=correction-user-infos"), session);

      const next = await sessionService.get(userId);
      expect(next.step).toBe("collecting");
      expect((next.data as any).answers).toEqual({});
      expect((next.data as any).affiliateId).toBe(9);
      expect(bot.sendMessage).toHaveBeenLastCalledWith(chatId, "Nome Completo:");
    });

    it("índice específico: entra em modo correção daquele campo", async () => {
      const bot = fakeBot();

      await registerFlow.handleCallback(bot, query("choice=1&for=correction-user-infos"), session);

      const next = await sessionService.get(userId);
      expect((next.data as any).fieldCorrection).toBe(1);
      expect(bot.sendMessage).toHaveBeenCalledWith(chatId, expect.stringContaining("Email"));
    });
  });
});
