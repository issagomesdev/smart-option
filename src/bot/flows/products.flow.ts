import TelegramBot from "node-telegram-bot-api";
import { ProductsService } from "../../services/bot/products.service";
import { RequestsService } from "../../services/bot/requests.service";
import { TransactionsService } from "../../services/bot/transactions.service";
import { sessionService, BotSession } from "../session.service";
import { backToMainMenuKeyboard, inlineKeyboard } from "../keyboards";
import { sendError, sendSuccess } from "../ux";
import { generatePaymentLink } from "../payment-link";

type Plan = Awaited<ReturnType<typeof ProductsService.products>>[number];

interface ProductsData {
  plans?: Plan[];
  chosenPlanId?: number;
}

function formatBRL(value: number): string {
  return (Math.floor(value * 100) / 100).toString().replace(".", ",");
}

export async function start(bot: TelegramBot, chatId: number, userId: number): Promise<void> {
  const plans = await ProductsService.products();
  await sessionService.enterFlow(userId, "products", null, { plans });

  await bot.sendMessage(chatId, "Escolha um de nossos serviços abaixo: ", { reply_markup: backToMainMenuKeyboard() });
  for (let i = 0; i < plans.length; i++) {
    await bot.sendMessage(chatId, plans[i].description, inlineKeyboard([{ text: "COMPRAR", callback_data: `choice=${i}&for=choose-plan` }]));
  }
}

export async function handleCallback(bot: TelegramBot, query: TelegramBot.CallbackQuery, session: BotSession): Promise<void> {
  const chatId = query.message!.chat.id;
  const userId = query.from.id;
  const params = new URLSearchParams(query.data ?? "");
  const data = session.data as ProductsData;
  const plans = data.plans ?? [];
  const for_ = params.get("for");

  if (for_ === "choose-plan") {
    const plan = plans[Number(params.get("choice"))];
    if (!plan) return;

    await sessionService.set(userId, { flow: "products", step: "confirm", data: { ...data, chosenPlanId: plan.id } });
    await bot.sendMessage(chatId, "O plano escolhido foi:");
    await bot.sendMessage(chatId, plan.description);
    await bot.sendMessage(chatId, "Ao clicar em sim, você automaticamente aceita os termos e condições referente a adesão do serviço de sua escolha.");
    await bot.sendMessage(
      chatId,
      "Confirma?",
      inlineKeyboard([
        { text: "✅ SIM", callback_data: "choice=yes&for=confirm-choose-plan" },
        { text: "❌ NÃO", callback_data: "choice=no&for=confirm-choose-plan" },
      ]),
    );
    return;
  }

  const plan = plans.find((p) => p.id === data.chosenPlanId);
  if (!plan) return;
  const price = parseFloat(plan.price);

  if (for_ === "confirm-choose-plan") {
    if (params.get("choice") !== "yes") {
      await start(bot, chatId, userId);
      return;
    }

    if (plan.purchaseType === "auto") {
      const balance = await TransactionsService.balance(userId);

      if (balance > 0) {
        if (balance >= price) {
          await bot.sendMessage(
            chatId,
            `Seu saldo atual é de R$ ${formatBRL(balance)}, suficiente para cobrir o custo do produto selecionado. Você tem a opção de utilizar esse saldo para abater o valor ou gerar um link de pagamento para cobrir o valor total da compra!`,
            inlineKeyboard([
              { text: "Utilizar Saldo", callback_data: "choice=balance&for=choose-balance-link" },
              { text: "Gerar Link de Pagamento", callback_data: "choice=link&for=choose-balance-link" },
            ]),
          );
        } else {
          await bot.sendMessage(
            chatId,
            `Seu saldo atual é de R$ ${formatBRL(balance)}, suficiente para cobrir parte do custo do produto selecionado. Você tem a opção de fazer um depósito no valor restante e descontar diretamente do seu saldo ou gerar um link de pagamento para cobrir o valor total da compra!`,
            inlineKeyboard([
              { text: "Realizar Depósito", callback_data: "choice=deposit&for=choose-balance-link" },
              { text: "Gerar Link de Pagamento", callback_data: "choice=link&for=choose-balance-link" },
            ]),
          );
        }
      } else {
        await sessionService.clear(userId);
        await generatePaymentLink(bot, chatId, userId, price, plan);
      }
    } else {
      try {
        await RequestsService.request("service", userId, String(plan.id));
        await sessionService.clear(userId);
        await sendSuccess(bot, chatId, "Pedido realizado com sucesso. Em breve nosso suporte entrará em contato.");
      } catch (error: any) {
        await sendError(bot, chatId, error.message);
      }
    }
    return;
  }

  if (for_ === "choose-balance-link") {
    if (params.get("choice") === "link") {
      await sessionService.clear(userId);
      await generatePaymentLink(bot, chatId, userId, price, plan);
    } else if (params.get("choice") === "deposit") {
      const balance = await TransactionsService.balance(userId);
      await sessionService.clear(userId);
      await generatePaymentLink(bot, chatId, userId, price - balance);
    } else if (params.get("choice") === "balance") {
      try {
        await TransactionsService.subscriptionWithBalance(userId, plan);
        await sessionService.clear(userId);
        await sendSuccess(bot, chatId, "O produto selecionado foi adquirido com sucesso!");
      } catch (error: any) {
        await sendError(bot, chatId, error.message);
      }
    }
  }
}
