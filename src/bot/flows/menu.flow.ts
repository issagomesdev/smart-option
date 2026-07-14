import TelegramBot from "node-telegram-bot-api";
import { AuthenticationService } from "../../services/bot/auth.service";
import { TransactionsService } from "../../services/bot/transactions.service";
import { sessionService, BotSession } from "../session.service";
import { financialMenuKeyboard, mainMenuKeyboard, BACK_TO_MAIN_MENU, BACK_TO_FINANCIAL_MENU } from "../keyboards";
import { sendError, sendTyping } from "../ux";
import { showAuthMenu } from "./auth.flow";
import * as registerFlow from "./register.flow";
import * as depositFlow from "./deposit.flow";
import * as withdrawalFlow from "./withdrawal.flow";
import * as transferFlow from "./transfer.flow";
import * as productsFlow from "./products.flow";
import * as supportFlow from "./support.flow";
import { showNetwork } from "../views/network.view";
import { showAffiliateLink } from "../views/affiliate-link.view";
import { showRules } from "../views/rules.view";
import { showExtract, showDepositRequests, showWithdrawalRequests, showSubscriptionRequests } from "../views/extract.view";

export async function returnToMainMenu(bot: TelegramBot, chatId: number, userId: number): Promise<void> {
  await sessionService.clear(userId);
  await bot.sendMessage(chatId, "Você retornou ao menu principal", { reply_markup: mainMenuKeyboard });
}

export async function returnToFinancialMenu(bot: TelegramBot, chatId: number, userId: number): Promise<void> {
  await sessionService.clear(userId);
  await bot.sendMessage(chatId, "Você retornou ao menu financeiro", { reply_markup: financialMenuKeyboard });
}

export async function handleCommand(bot: TelegramBot, msg: TelegramBot.Message, session: BotSession, loggedInUser: { id: number }): Promise<void> {
  const chatId = msg.chat.id;
  const userId = msg.from!.id;

  switch (msg.text) {
    case "🎯 PRODUTOS E SERVIÇOS":
      await productsFlow.start(bot, chatId, userId);
      break;
    case "🪪 CADASTRO":
      // Usuário logado cadastrando um novo indicado a partir do próprio chat
      // — ele mesmo entra como afiliado/patrocinador do novo cadastro
      // (mesmo comportamento do fluxo original).
      await registerFlow.start(bot, chatId, userId, loggedInUser.id);
      break;
    case "🔗 LINK DE AFILIADO":
      await showAffiliateLink(bot, chatId, userId);
      break;
    case "💰 SALDO": {
      await sendTyping(bot, chatId);
      const balance = await TransactionsService.balance(userId);
      await bot.sendMessage(chatId, `Saldo atual: R$ ${(Math.floor(balance * 100) / 100).toString().replace(".", ",")}`);
      break;
    }
    case "🚻 REDE":
      await showNetwork(bot, chatId, userId);
      break;
    case "💲FINANCEIRO":
      await bot.sendMessage(chatId, "Você está dentro do menu financeiro", { reply_markup: financialMenuKeyboard });
      break;
    case "➕💵 DEPÓSITO":
      await depositFlow.start(bot, chatId, userId);
      break;
    case "➖💵 SAQUE": {
      await sendTyping(bot, chatId);
      const hasPending = await TransactionsService.hasWithdrawalPendingRequests(userId);
      if (hasPending) {
        await bot.sendMessage(
          chatId,
          "Já existe um pedido de saque sendo analisado pela nossa equipe, acompanhe o andamento em *Solicitações de saque* dentro do menu financeiro.",
          { parse_mode: "Markdown" },
        );
      } else {
        await withdrawalFlow.start(bot, chatId, userId);
      }
      break;
    }
    case "💲🔄 TRANSFERIR SALDO":
      await transferFlow.start(bot, chatId, userId);
      break;
    case "🧾 EXTRATO":
      await showExtract(bot, chatId, userId);
      break;
    case "📥 SOLICITAÇÕES DE DEPÓSITO":
      await showDepositRequests(bot, chatId, userId);
      break;
    case "📤 SOLICITAÇÕES DE SAQUE":
      await showWithdrawalRequests(bot, chatId, userId);
      break;
    case "🛒 SOLICITAÇÕES DE ADESÃO":
      await showSubscriptionRequests(bot, chatId, userId);
      break;
    case "📃 DÚVIDAS GERAIS":
      await showRules(bot, chatId);
      break;
    case "📱 ATENDIMENTO AO CLIENTE":
      await supportFlow.start(bot, chatId, userId);
      break;
    case BACK_TO_MAIN_MENU:
      await returnToMainMenu(bot, chatId, userId);
      break;
    case BACK_TO_FINANCIAL_MENU:
      await returnToFinancialMenu(bot, chatId, userId);
      break;
    case "🔚SAIR DA CONTA":
      try {
        await AuthenticationService.logout(userId);
        await sessionService.clear(userId);
        await showAuthMenu(bot, chatId);
      } catch (error: any) {
        await sendError(bot, chatId, error.message);
      }
      break;
    default:
      // Comando não reconhecido enquanto não há fluxo ativo — silenciosamente ignorado, igual ao comportamento original.
      break;
  }
}
