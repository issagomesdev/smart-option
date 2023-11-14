import { choose_services, products_callbacks, to_go_back } from "../services/products";
import { register_instructions, fields, register_callbacks } from "../services/register";
import { affiliate_link } from "../services/affiliateLink";
import { show_balance, deposit_instructions, make_deposit, deposit_callbacks, withdraw_instructions, make_withdraw, withdraw_callbacks } from "../services/balance";
import { show_network_level } from "../services/network";
import { bot } from "..";


export function return_main_menu(chatId:number) {
  switch (section) {
    case 1:
      bot.removeListener('message', to_go_back);
      bot.removeListener('callback_query', products_callbacks);
    break;
    case 2:
      bot.removeListener('message', fields);
      bot.removeListener('callback_query', register_callbacks);
    break;
    case 6:
      bot.removeListener('message', make_deposit);
      bot.removeListener('callback_query', deposit_callbacks);
    break;
    case 7:
      bot.removeListener('message', make_withdraw);
      bot.removeListener('callback_query', withdraw_callbacks);
    break;
  }
  section = null;
  bot.sendMessage(chatId, 'Você retornou ao menu principal', {
    reply_markup: main_menu,
  });
}

export const main_menu:any = {
  keyboard: [
    ['🎯 PRODUTOS E SERVIÇOS'],
    ['🪪 CADASTRO', '🔗 LINK DE AFILIADO'],
    ['💰 SALDO', '🚻 REDE'],
    ['💵 DEPÓSITO', '💵 SAQUE'],
    ['DÚVIDAS FREQUENTES'],
    ['📝 SUPORTE & ATENDIMENTO AO CLIENTE 🆘'],
  ],
  one_time_keyboard: false, 
};

export const _return:any = {
  keyboard: [
    ['VOLTAR AO MENU PRINCIPAL'],
  ],
  one_time_keyboard: false, 
};

let section:number|null;

export function goTo(msg:any) {
  switch (msg.text) {
    case "🎯 PRODUTOS E SERVIÇOS":
      section = 1;
      choose_services(msg.chat.id);
      bot.on('message', to_go_back);
      bot.on('callback_query', products_callbacks);
    break;
    case "🪪 CADASTRO":
      section = 2;
      register_instructions(msg.chat.id);
      bot.on('message', fields);
      bot.on('callback_query', register_callbacks);
    break;
    case "🔗 LINK DE AFILIADO":
      section = 3;
      affiliate_link(msg.chat.id, msg.from.id);
    break;
    case "💰 SALDO":
      section = 4;
      show_balance(msg.chat.id, msg.from.id)
    break;
    case "🚻 REDE":
      section = 5;
      show_network_level(msg.chat.id, msg.from.id)
    break;
    case "💵 DEPÓSITO":
      section = 6;
      deposit_instructions(msg.chat.id, msg.from.id)
      bot.on('message', make_deposit);
      bot.on('callback_query', deposit_callbacks);
    break;
    case "💵 SAQUE":
      section = 7;
      withdraw_instructions(msg.chat.id, msg.from.id)
      bot.on('message', make_withdraw);
      bot.on('callback_query', withdraw_callbacks);
    break;
    case "VOLTAR AO MENU PRINCIPAL":
      return_main_menu(msg.chat.id)
    break;
}
}