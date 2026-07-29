import TelegramBot from "node-telegram-bot-api";
import { CPF_TAKEN_MESSAGE, EMAIL_TAKEN_MESSAGE, RegisterService, RegisterUserInput } from "../../services/bot/register.service";
import { sessionService, BotSession } from "../session.service";
import { backToAuthMenuKeyboard, inlineKeyboard } from "../keyboards";
import { sendError, sendTyping } from "../ux";
import { toUserMessage } from "../errors";
import { isValidCpf } from "../../shared/validation/cpf";

interface Question {
  field: string;
  text: string;
}

const QUESTIONS: Question[] = [
  { field: "name", text: "Nome Completo" },
  { field: "email", text: "Email" },
  { field: "password", text: "Senha" },
  { field: "confirm_password", text: "Confirme sua senha" },
  { field: "phone_number", text: "Telefone" },
  { field: "cpf", text: "CPF" },
  { field: "adress", text: "Endereço" },
  { field: "pix_code", text: "Código Pix" },
];
const EMAIL_INDEX = 1;
const PASSWORD_INDEX = 2;
const CONFIRM_PASSWORD_INDEX = 3;
const CPF_INDEX = 5;

interface RegisterData {
  answers: Record<string, string>;
  currentField: number;
  fieldCorrection: number | null;
  affiliateId: number | null;
}

function readData(session: BotSession): RegisterData {
  return session.data as unknown as RegisterData;
}

async function writeData(userId: number, step: "collecting" | "confirm" | "submitting", data: RegisterData): Promise<void> {
  await sessionService.set(userId, { flow: "register", step, data: data as unknown as Record<string, unknown> });
}

function freshData(affiliateId: number | null = null): RegisterData {
  return { answers: {}, currentField: 0, fieldCorrection: null, affiliateId };
}

/** Índice do campo a recorrigir quando o cadastro falhou por dado já usado; `null` se o erro for de outra natureza. */
function duplicateFieldIndex(error: unknown): number | null {
  const message = toUserMessage(error);
  if (message === EMAIL_TAKEN_MESSAGE) return EMAIL_INDEX;
  if (message === CPF_TAKEN_MESSAGE) return CPF_INDEX;
  return null;
}

/** `null` = válido. CPF é a única validação de formato aplicada durante a coleta — as demais seguem como texto livre, igual ao fluxo original. */
function validateFieldValue(field: string, value: string): string | null {
  if (field === "cpf" && !isValidCpf(value)) {
    return "CPF inválido. Digite novamente, só números ou no formato 123.456.789-00:";
  }
  return null;
}

async function askQuestion(bot: TelegramBot, chatId: number, index: number): Promise<void> {
  await bot.sendMessage(chatId, `${QUESTIONS[index].text}:`);
  if (QUESTIONS[index].field === "pix_code") {
    await bot.sendMessage(
      chatId,
      "OBS: Para chaves PIX do tipo celular ou CPF, utilize apenas números, sem caracteres especiais. Exemplo: 11987654321 ou 12345678900.",
    );
  }
}

export async function start(bot: TelegramBot, chatId: number, userId: number, affiliateId: number | null = null): Promise<void> {
  await sessionService.enterFlow(userId, "register", "collecting", freshData(affiliateId) as unknown as Record<string, unknown>);
  await bot.sendMessage(chatId, "Para realizar seu cadastro em nosso sistema, digite corretamente a resposta para os seguintes campos", {
    reply_markup: backToAuthMenuKeyboard(),
  });
  await askQuestion(bot, chatId, 0);
}

export async function handleMessage(bot: TelegramBot, msg: TelegramBot.Message, session: BotSession): Promise<void> {
  const chatId = msg.chat.id;
  const userId = msg.from!.id;
  const text = msg.text ?? "";
  const data = readData(session);

  // "confirm": aguardando o callback de confirmação. "submitting": cadastro já em andamento —
  // nos dois casos, texto solto não é resposta de campo nenhum e seria gravado por engano.
  if (session.step === "confirm" || session.step === "submitting") return;

  if (data.fieldCorrection !== null) {
    const field = QUESTIONS[data.fieldCorrection].field;
    const invalidReason = validateFieldValue(field, text);
    if (invalidReason) {
      await bot.sendMessage(chatId, invalidReason);
      return;
    }

    const answers = { ...data.answers, [field]: text };

    if (data.fieldCorrection === PASSWORD_INDEX) {
      await writeData(userId, "collecting", { ...data, answers, fieldCorrection: CONFIRM_PASSWORD_INDEX });
      await askQuestion(bot, chatId, CONFIRM_PASSWORD_INDEX);
      return;
    }

    if (data.fieldCorrection === CONFIRM_PASSWORD_INDEX && answers.password !== answers.confirm_password) {
      await bot.sendMessage(chatId, "As senhas digitadas não coincidem, para realizar seu cadastro redigite sua senha:");
      await writeData(userId, "collecting", { ...data, answers, fieldCorrection: PASSWORD_INDEX });
      return;
    }

    await writeData(userId, "confirm", { ...data, answers, fieldCorrection: null });
    await confirmFields(bot, chatId, answers);
    return;
  }

  const invalidReason = validateFieldValue(QUESTIONS[data.currentField].field, text);
  if (invalidReason) {
    await bot.sendMessage(chatId, invalidReason);
    return;
  }

  const answers = { ...data.answers, [QUESTIONS[data.currentField].field]: text };

  if (data.currentField < QUESTIONS.length - 1) {
    if (data.currentField === CONFIRM_PASSWORD_INDEX && answers.password !== answers.confirm_password) {
      await bot.sendMessage(chatId, "As senhas digitadas não coincidem, para realizar seu cadastro redigite sua senha:");
      await writeData(userId, "collecting", { ...data, answers, currentField: PASSWORD_INDEX });
      return;
    }

    const nextField = data.currentField + 1;
    await writeData(userId, "collecting", { ...data, answers, currentField: nextField });
    await askQuestion(bot, chatId, nextField);
  } else {
    await writeData(userId, "confirm", { ...data, answers });
    await confirmFields(bot, chatId, answers);
  }
}

function formatAnswers(answers: Record<string, string>): string {
  return QUESTIONS.filter((q) => q.field !== "confirm_password")
    .map((q) => (q.field === "password" ? `${q.text}: ${"*".repeat(answers[q.field]?.length ?? 0)}` : `${q.text}: ${answers[q.field]}`))
    .join("\n");
}

async function confirmFields(bot: TelegramBot, chatId: number, answers: Record<string, string>): Promise<void> {
  await bot.sendMessage(chatId, "Verifique atentamente suas informações abaixo e confirme se tudo foi inserido corretamente");
  await bot.sendMessage(chatId, formatAnswers(answers));
  await bot.sendMessage(
    chatId,
    "Confirma?",
    inlineKeyboard([
      { text: "✅ SIM", callback_data: "choice=yes&for=confirm-user-infos" },
      { text: "❌ NÃO", callback_data: "choice=no&for=confirm-user-infos" },
    ]),
  );
}

export async function handleCallback(bot: TelegramBot, query: TelegramBot.CallbackQuery, session: BotSession): Promise<void> {
  const chatId = query.message!.chat.id;
  const userId = query.from.id;
  const params = new URLSearchParams(query.data ?? "");
  const data = readData(session);

  if (params.get("for") === "confirm-user-infos") {
    if (params.get("choice") === "yes") {
      // Guarda contra duplo clique no ✅ SIM. Sem ela, dois toques em sequência viram dois
      // callbacks concorrentes: ambos passam pela checagem prévia de e-mail antes de qualquer
      // INSERT commitar, um cadastra e responde "sucesso" e o outro estoura na chave única
      // (bug real relatado — o usuário recebeu o erro do banco e a mensagem de sucesso juntos).
      if (session.step === "submitting") return;
      await writeData(userId, "submitting", data);

      await sendTyping(bot, chatId);
      try {
        await RegisterService.registerUser(data.answers as unknown as RegisterUserInput, data.affiliateId);
        await bot.sendMessage(chatId, "_Cadastro realizado com sucesso!_ ✅", { parse_mode: "Markdown" });
        await bot.sendMessage(
          chatId,
          "Antes de tudo é necessário validar o email de cadastro, um link de validação foi enviado agora mesmo, acesse o link para liberar o acesso",
        );
        await sessionService.clear(userId);
      } catch (error) {
        await sendError(bot, chatId, toUserMessage(error));

        // Dado duplicado é recuperável: leva direto à correção do campo em questão, em vez de
        // devolver o usuário ao início do cadastro.
        const retryIndex = duplicateFieldIndex(error);
        if (retryIndex !== null) {
          await bot.sendMessage(chatId, `Para realizar seu cadastro em nosso sistema, digite novamente o valor do campo ${QUESTIONS[retryIndex].text}:`);
          await writeData(userId, "collecting", { ...data, fieldCorrection: retryIndex });
          return;
        }

        // Falha não recuperável (backend fora do ar, erro inesperado): mantém tudo o que já foi
        // digitado e devolve à tela de confirmação, para o usuário poder tentar de novo.
        await writeData(userId, "confirm", data);
        await confirmFields(bot, chatId, data.answers);
      }
      return;
    }

    await bot.sendMessage(chatId, "Qual informação deseja corrigir?");
    await bot.sendMessage(chatId, "Tudo", inlineKeyboard([{ text: "Editar", callback_data: "choice=all&for=correction-user-infos" }]));
    for (const [index, question] of QUESTIONS.entries()) {
      if (question.field === "confirm_password") continue;
      await bot.sendMessage(chatId, question.text, inlineKeyboard([{ text: "Editar", callback_data: `choice=${index}&for=correction-user-infos` }]));
    }
    return;
  }

  if (params.get("for") === "correction-user-infos") {
    if (params.get("choice") === "all") {
      await writeData(userId, "collecting", freshData(data.affiliateId));
      await bot.sendMessage(chatId, "Para realizar seu cadastro em nosso sistema, digite corretamente a resposta para os seguintes campos");
      await askQuestion(bot, chatId, 0);
    } else {
      const index = Number(params.get("choice"));
      await bot.sendMessage(chatId, `Para realizar seu cadastro em nosso sistema, digite novamente o valor do campo ${QUESTIONS[index].text}:`);
      if (QUESTIONS[index].field === "pix_code") {
        await bot.sendMessage(chatId, "OBS: Para chaves PIX do tipo celular ou CPF, utilize apenas números, sem caracteres especiais. Exemplo: 11987654321 ou 12345678900.");
      }
      await writeData(userId, "collecting", { ...data, fieldCorrection: index });
    }
  }
}
