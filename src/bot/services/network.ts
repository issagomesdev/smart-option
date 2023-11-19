import { NetworkService } from "../../services/bot/network.service";
import { bot } from "..";

const level1:any = async(userId:number) => {
    return await NetworkService.affiliateNetwork(userId, '1')
}
const level2:any = async(userId:number) => {
    return await NetworkService.affiliateNetwork(userId, '2')
}

const level3:any = async(userId:number) => {
    return await NetworkService.affiliateNetwork(userId, '3')
}

export async function show_network_level(chatId:number, user:any) {
    await bot.sendMessage(chatId, `*Nivel 1*\n\n${(await level1(user.id)).length > 0? (await level1(user.id)).map(user => user.name).join('\n') : "Rede vazia"}`, { parse_mode: 'Markdown' });
    await bot.sendMessage(chatId, `*Nivel 2*\n\n${(await level2(user.id)).length > 0? (await level2(user.id)).map(user => user.name).join('\n') : "Rede vazia"}`, { parse_mode: 'Markdown' });
    await bot.sendMessage(chatId, `*Nivel 3*\n\n${(await level3(user.id)).length > 0? (await level3(user.id)).map(user => user.name).join('\n'): "Rede vazia"}`, { parse_mode: 'Markdown' });
    return;
}