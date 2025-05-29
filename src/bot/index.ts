import TelegramBot from 'node-telegram-bot-api';
const token = process.env.BOT_TOKEN;
export const bot = new TelegramBot(token, { polling: true });
import { goTo, main_menu } from "./components/mainMenu"
import { isLoggedIn, logIn } from "./components/auth";

export async function start() {
  
  bot.on('message', async(msg) => {
    try {
      
      if(await isLoggedIn(msg.from.id)){

        if(/\/start/.test(msg.text)){
          bot.sendMessage(msg.chat.id, 'Para iniciar, clique no menu abaixo em “PRODUTOS E SERVIÇOS” para conhecer os planos mensais, serviços e produtos.', {
            reply_markup: main_menu,
          });
        }

        goTo(msg)
      
    } else {

      let affiliateId:number = null;

      if (/^\/start (.+)/.test(msg.text)) {
        const match = msg.text.match(/^\/start (.+)/);
        affiliateId = Number(match[1]);
      }
      
      logIn(msg, affiliateId)
    }
    
    } catch (error) {
      console.log(error)
    }
  });

}

