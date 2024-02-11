import TelegramBot from 'node-telegram-bot-api';
//const token = '6962207233:AAH_eijZs5TI8MO17wuVTtRfHctj8C_QwHI'; //teste
const token = '6600468394:AAGs7ZCY_-LMH-iRtoQKD9Hn4R_K-cyHsa0'; //real
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

