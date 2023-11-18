import { bot } from "..";

export function suport(chatId:number){
    bot.sendMessage(chatId, "Digite a sua dúvida. Responderemos o mais breve possível.");
}