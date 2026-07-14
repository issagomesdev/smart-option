import TelegramBot from "node-telegram-bot-api";
import { AsciiTable3, AlignmentEnum } from "ascii-table3";
import { NetworkService } from "../../services/bot/network.service";
import { sendError } from "../ux";

export async function showNetwork(bot: TelegramBot, chatId: number, userId: number): Promise<void> {
  try {
    const data = await NetworkService.affiliateNetwork(userId);
    const rows = data.map((item) => [`#${item.id} ${item.name}`, item.level, item.status ? "Ativo" : "Inativo"]);

    const table = new AsciiTable3("REDE")
      .setHeading("Convidado", "Nivel", "Situação")
      .setAlign(2, AlignmentEnum.CENTER)
      .addRowMatrix(rows)
      .setStyle("compact");

    await bot.sendMessage(chatId, `<pre>${table.toString()}</pre>`, { parse_mode: "HTML" });
  } catch (error: any) {
    await sendError(bot, chatId, error.message);
  }
}
