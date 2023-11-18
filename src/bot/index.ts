import TelegramBot from 'node-telegram-bot-api';
const token = '6962207233:AAEDOQOTowtq8wrVABjLpdvLxvmiJZkwtkI';
export const bot = new TelegramBot(token, { polling: true });
import { goTo, main_menu } from "./components/mainMenu"
import { isLoggedIn, option, logIn } from "./components/auth";

export async function start() {


  bot.on('message', async(msg) => {
    console.log(msg)
    if(await isLoggedIn(msg.from.id)){

        if(/\/start/.test(msg.text)){
          bot.sendMessage(msg.chat.id, 'Para iniciar, clique no menu abaixo em “PRODUTOS E SERVIÇOS” para conhecer os planos mensais, serviços e produtos.', {
            reply_markup: main_menu,
          });
        }

      goTo(msg)
      
    } else {
      logIn(msg)
    }
  });

}

