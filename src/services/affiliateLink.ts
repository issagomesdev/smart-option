import { bot } from "..";

export function affiliate_link(chatId:number, userId:number) {
    bot.sendMessage(chatId, `https://www.exemple.affiliate-link.com.br/${userId}`);
    return;
}


