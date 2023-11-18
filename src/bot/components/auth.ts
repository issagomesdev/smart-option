import { bot } from "..";
import { AuthenticationService } from "../../services/bot/auth.service";
import { register_instructions, fields, register_callbacks } from "../services/register";
import { _return } from "./mainMenu";
import { login_instructions, login, login_callbacks } from "../services/login";
import { main_menu, goTo } from "./mainMenu";

export async function isLoggedIn(userId:number) {
    return await AuthenticationService.isLoggedIn(userId)
}

export const option:any = {
    keyboard: [
      ['LOGIN', 'CADASTRO']
    ],
    one_time_keyboard: false, 
  };

  export async function return_(chatId:number, userId:number = null) {
    switch (section) {
      case 1:
        bot.removeListener('message', fields);
        bot.removeListener('callback_query', register_callbacks);
      break;
      case 2:
        bot.removeListener('message', login);
        bot.removeListener('callback_query', login_callbacks);
      break;
    }
    section = null;

    if(userId && await isLoggedIn(userId)){
        bot.sendMessage(chatId, 'Para iniciar, clique no menu abaixo em “PRODUTOS E SERVIÇOS” para conhecer os planos mensais, serviços e produtos.', {
            reply_markup: main_menu,
          });
    } else {
        bot.sendMessage(chatId, 'Entre em sua conta para continuar ou se ainda não possue uma conta cadastre-se agora', {
          reply_markup: option,
        });
    }
  }

  export let section:number;

  export async function logIn(msg:any) {
    switch (msg.text) {
      case "CADASTRO":
        section = 1;
        register_instructions(msg.chat.id);
        bot.on('message', fields);
        bot.on('callback_query', register_callbacks);
      break;
      case "LOGIN":
        section = 2;
        login_instructions(msg.chat.id);
        bot.on('message', login);
        bot.on('callback_query', login_callbacks);
      break;
      case "VOLTAR":
        return_(msg.chat.id)
      break;
      default:
      if(!section){
        bot.sendMessage(msg.chat.id, 'Entre em sua conta para continuar ou se ainda não possue uma conta cadastre-se agora', {
            reply_markup: option,
          });
      }
  }
  }

