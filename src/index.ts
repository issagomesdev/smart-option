import * as TelegramBot from 'node-telegram-bot-api';
const token = '6962207233:AAEDOQOTowtq8wrVABjLpdvLxvmiJZkwtkI';
export const bot = new TelegramBot(token, { polling: true });
import { goTo, main_menu } from "./components/mainMenu"

bot.onText(/\/start/, (msg) => {
  bot.sendMessage(msg.chat.id, 'Para iniciar, clique no main_menu abaixo em “PRODUTOS E SERVIÇOS” para conhecer os planos mensais, serviços e produtos.', {
    reply_markup: main_menu,
  });
});

bot.on('message', goTo);

