import { bot } from "..";

let level1:Array<string> = [
    "Nome1",
    "Nome2",
    "Nome3"
];
let level2:Array<string> = [
    "Nome1",
    "Nome2",
    "Nome3"
];
let level3:Array<string> = [
    "Nome1",
    "Nome2",
    "Nome3"
];

export function show_network_level(chatId:number, userId:number) {
    bot.sendMessage(chatId, `Nivel 1\n\n${level1.join('\n')}`);
    bot.sendMessage(chatId, `Nivel 2\n\n${level2.join('\n')}`);
    bot.sendMessage(chatId, `Nivel 3\n\n${level3.join('\n')}`);
    return;
}