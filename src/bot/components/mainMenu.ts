import { choose_services, products_callbacks } from "../sections/products";
import { register_instructions, fields, register_callbacks } from "../sections/register";
import { AuthenticationService } from "../../services/bot/auth.service";
import { affiliate_link } from "../sections/affiliateLink";
import { show_balance, deposit_instructions, make_deposit, deposit_callbacks, withdrawal_instructions, make_withdrawal, withdrawal_callbacks, extract, depositRequests, withdrawalRequests, subscriptionRequests, transfer_instructions, make_transfer, transfer_callbacks } from "../sections/balance";
import { TransactionsService } from "../../services/bot/transactions.service";
import { show_network_level } from "../sections/network";
import { show_rules } from "../sections/rules";
import { suport, message } from "../sections/suport";
import { isLoggedIn, logIn } from "./auth";
import { bot } from "..";


export function return_main_menu(chatId:number) {
  switch (section) {
    case 1:
      bot.removeListener('callback_query', products_callbacks);
    break;
    case 2:
      bot.removeListener('message', fields);
      bot.removeListener('callback_query', register_callbacks);
    break;
    case 9:
      bot.removeListener('message', message);
    break;
  }
  section = null;
  bot.sendMessage(chatId, 'Você retornou ao menu principal', {
    reply_markup: main_menu,
  });
}

export function return_financial_options(chatId:number) {
  switch (section) {
    case 6:
      bot.removeListener('message', make_deposit);
      bot.removeListener('callback_query', deposit_callbacks);
    break;
    case 7:
      bot.removeListener('message', make_withdrawal);
      bot.removeListener('callback_query', withdrawal_callbacks);
    break;
    case 8:
      bot.removeListener('message', make_transfer);
      bot.removeListener('callback_query', transfer_callbacks);
    break;
  }
  section = null;
  bot.sendMessage(chatId, 'Você retornou ao menu financeiro', {
    reply_markup: financial_options,
  });
}

export const main_menu:any = {
  keyboard: [
    ['🎯 PRODUTOS E SERVIÇOS'],
    ['🪪 CADASTRO', '🔗 LINK DE AFILIADO'],
    ['🚻 REDE', '💲FINANCEIRO'],
    ['📃 DÚVIDAS GERAIS'],
    ['📱 ATENDIMENTO AO CLIENTE'],
    ['🔚SAIR DA CONTA'],
  ],
  one_time_keyboard: false, 
};

export const financial_options:any = {
  keyboard: [
    ['➕💵 DEPÓSITO', '➖💵 SAQUE'],
    ['💲🔄 TRANSFERIR SALDO'],
    ['💰 SALDO', '🧾 EXTRATO'],
    ['📥 SOLICITAÇÕES DE DEPÓSITO', '📤 SOLICITAÇÕES DE SAQUE'],
    ['🛒 SOLICITAÇÕES DE ADESÃO'],
    ['🔄 VOLTAR AO MENU PRINCIPAL'],
  ],
  one_time_keyboard: false, 
};

export const _return:any = async(userId:number, financial:boolean = false) => {
 return {
  keyboard: [
    financial? ['🔄 VOLTAR AO MENU FINANCEIRO'] : await isLoggedIn(userId)? ['🔄 VOLTAR AO MENU PRINCIPAL'] : ['🔄 VOLTAR'],
 ],
 one_time_keyboard: false, 
 }
};

let section:number;

export async function goTo(msg:any) {

  const user:any = await isLoggedIn(msg.from.id);
  
  switch (msg.text) {
    case "🎯 PRODUTOS E SERVIÇOS":
      section = 1;
      choose_services(msg.chat.id);
      bot.on('callback_query', products_callbacks);
    break;
    case "🪪 CADASTRO":
      section = 2;
      register_instructions(msg.chat.id, user?.id);
      bot.on('message', fields);
      bot.on('callback_query', register_callbacks);
    break;
    case "🔗 LINK DE AFILIADO":
      affiliate_link(msg.chat.id, msg.from.id);
    break;
    case "💰 SALDO":
      show_balance(msg.chat.id, msg.from.id)
    break;
    case "🚻 REDE":
      show_network_level(msg.chat.id, msg.from.id)
    break;
    case "💲FINANCEIRO":
      bot.sendMessage(msg.chat.id, 'Você está dentro do menu financeiro', {
        reply_markup: financial_options,
      });
    break;
    case "➕💵 DEPÓSITO":
      section = 6;
      deposit_instructions(msg.chat.id, msg.from.id)
      bot.on('message', make_deposit);
      bot.on('callback_query', deposit_callbacks);
    break;
    case "➖💵 SAQUE":
      TransactionsService.hasWithdrawalPendingRequests(msg.from.id).then((has) => {
        if(has){
          bot.sendMessage(msg.chat.id, "Já existe um pedido de saque sendo analisado pela nossa equipe, acompanhe o andamento em *Solicitações de saque* dentro do menu financeiro.", { parse_mode: 'Markdown' }); 
        } else {
          section = 7;
          withdrawal_instructions(msg.chat.id, msg.from.id)
          bot.on('message', make_withdrawal);
          bot.on('callback_query', withdrawal_callbacks);
        }
      });
    break; 
    case "💲🔄 TRANSFERIR SALDO":
      section = 8;
      transfer_instructions(msg.chat.id, msg.from.id)
      bot.on('message', make_transfer);
      bot.on('callback_query', transfer_callbacks);
    break; 
    case "🧾 EXTRATO":
      extract(msg.from.id)
    break;
    case "📥 SOLICITAÇÕES DE DEPÓSITO":
      depositRequests(msg.from.id)
    break;
    case "📤 SOLICITAÇÕES DE SAQUE":
      withdrawalRequests(msg.from.id)
    break;
    case "🛒 SOLICITAÇÕES DE ADESÃO":
      subscriptionRequests(msg.from.id)
    break;
    case "📃 DÚVIDAS GERAIS":
      show_rules(msg.chat.id)
    break;
    case "📱 ATENDIMENTO AO CLIENTE":
      section = 9;
      suport(msg.chat.id);
      bot.on('message', message);
    break;
    case "🔄 VOLTAR AO MENU PRINCIPAL":
      return_main_menu(msg.chat.id)
    break;
    case "🔄 VOLTAR AO MENU FINANCEIRO":
      return_financial_options(msg.chat.id)
    break;
    case "🔚SAIR DA CONTA":
    await AuthenticationService.logout(msg.from.id)
    .then(async() => {
      logIn(msg)
    })
    .catch(async(error) => {
      await bot.sendMessage(msg.chat.id, `*${error}*`, { parse_mode: 'Markdown' });
    });
    break;
}
}