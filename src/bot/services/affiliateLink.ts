import { AuthenticationService } from "../../services/bot/auth.service";
import { bot } from "..";

export async function affiliate_link(chatId:number, userId:number) {
    await AuthenticationService.isLoggedIn(userId)
    .then(async(data:any) => {
        await bot.sendMessage(chatId, `https://t.me/smartoptionea_bot?start=${encodeURIComponent(data.id)}`)
    })
    .catch(async(error) => {
      await bot.sendMessage(chatId, `*${error}*`, { parse_mode: 'Markdown' });
    });

}

