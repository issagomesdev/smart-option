import TelegramBot from "node-telegram-bot-api";
import { AsciiTable3, AlignmentEnum } from "ascii-table3";
import moment from "moment";
import { TransactionsService } from "../../services/bot/transactions.service";
import { sendError } from "../ux";

const ORIGIN_LABELS: Record<string, (referenceId: string | null) => string> = {
  deposit: () => "Depósito",
  withdrawal: () => "Saque",
  earnings: () => "Rentabilidade",
  profitability: (referenceId) => `B.R.#${referenceId}`,
  transfer: (referenceId) => `Transf#${referenceId}`,
  admin: () => "Transf#ADM",
  diamond_tax: () => "Taxa Diamante",
};

function originLabel(origin: string, type: "sum" | "subtract", referenceId: string | null): string {
  if (origin === "subscription") return type === "sum" ? `B.A.#${referenceId}` : "Adesão";
  if (origin === "tuition") return type === "sum" ? `B.M.#${referenceId}` : "Mensalidade";
  return ORIGIN_LABELS[origin]?.(referenceId) ?? "Outros";
}

const REQUEST_STATUS_LABELS: Record<string, string> = {
  PENDING: "Pendente",
  AUTHORIZED: "Pre-Autorizado",
  PAID: "Concluído",
  IN_ANALYSIS: "Em análise",
  DECLINED: "Recusado",
  CANCELED: "Cancelado",
};

const WITHDRAWAL_STATUS_LABELS: Record<string, string> = {
  pending: "Pendente",
  authorized: "Autorizado",
  refused: "Rejeitado",
  failed: "Falhou",
  success: "Concluído",
};

export async function showExtract(bot: TelegramBot, chatId: number, userId: number): Promise<void> {
  try {
    const data = await TransactionsService.extract(userId);
    const rows = data.map((item: any) => [
      `${item.type === "sum" ? "+" : "-"}${item.value}`,
      originLabel(item.origin, item.type, item.reference_id),
      moment(item.created_at).format("DD/MM/YY HH:mm"),
    ]);

    const table = new AsciiTable3("EXTRATO")
      .setHeading("Valor", "Origem", "Data")
      .setAlign(3, AlignmentEnum.CENTER)
      .addRowMatrix(rows)
      .setStyle("compact");

    await bot.sendMessage(chatId, `<pre>${table.toString()}</pre>`, { parse_mode: "HTML" });
  } catch (error: any) {
    await sendError(bot, chatId, error.message);
  }
}

export async function showDepositRequests(bot: TelegramBot, chatId: number, userId: number): Promise<void> {
  try {
    const data = await TransactionsService.checkoutsRequests(userId, "deposit");
    const rows = data.map((item: any) => [
      item.value,
      REQUEST_STATUS_LABELS[item.status] ?? "Pendente",
      moment(item.created_at).format("DD/MM/YY HH:mm"),
    ]);

    const table = new AsciiTable3("Solicitações De Depósito")
      .setHeading("Valor", "Status", "Data")
      .setAlign(3, AlignmentEnum.CENTER)
      .addRowMatrix(rows)
      .setStyle("compact");

    await bot.sendMessage(chatId, `<pre>${table.toString()}</pre>`, { parse_mode: "HTML" });
  } catch (error: any) {
    await sendError(bot, chatId, error.message);
  }
}

export async function showWithdrawalRequests(bot: TelegramBot, chatId: number, userId: number): Promise<void> {
  try {
    const data = await TransactionsService.withdrawalRequests(userId);
    const rows = data.map((item: any) => [
      item.value,
      WITHDRAWAL_STATUS_LABELS[item.status] ?? "Pendente",
      moment(item.created_at).format("DD/MM/YY HH:mm"),
    ]);

    const table = new AsciiTable3("Solicitações De Saques")
      .setHeading("Valor", "Status", "Data")
      .setAlign(3, AlignmentEnum.CENTER)
      .addRowMatrix(rows)
      .setStyle("compact");

    await bot.sendMessage(chatId, `<pre>${table.toString()}</pre>`, { parse_mode: "HTML" });
  } catch (error: any) {
    await sendError(bot, chatId, error.message);
  }
}

export async function showSubscriptionRequests(bot: TelegramBot, chatId: number, userId: number): Promise<void> {
  try {
    const data = await TransactionsService.checkoutsRequests(userId, "subscription");
    const rows = data.map((item: any) => [
      item.name,
      REQUEST_STATUS_LABELS[item.status] ?? "Pendente",
      moment(item.created_at).format("DD/MM/YY HH:mm"),
    ]);

    const table = new AsciiTable3("Solicitações De Adesão")
      .setHeading("Plano", "Status", "Data")
      .setAlign(3, AlignmentEnum.CENTER)
      .addRowMatrix(rows)
      .setStyle("compact");

    await bot.sendMessage(chatId, `<pre>${table.toString()}</pre>`, { parse_mode: "HTML" });
  } catch (error: any) {
    await sendError(bot, chatId, error.message);
  }
}
