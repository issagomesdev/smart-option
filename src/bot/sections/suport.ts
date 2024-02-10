import { bot } from "..";
import  { _return } from "../components/mainMenu";
import { RequestsService } from "../../services/bot/requests.service";

export async function suport(chatId:number){
    await bot.sendMessage(chatId, "Olá, como podemos te ajudar hoje? Por favor, deixe uma única mensagem, de forma clara e direta sobre ao assunto que lhe trouxe aqui: ", {
        reply_markup: await _return(chatId),
      });
}

export function message(msg:any){

    if(msg.text != "🔄 VOLTAR AO MENU PRINCIPAL"){
        RequestsService.request('support', msg.from.id, msg.text)
        .then(() => { 
            bot.sendMessage(msg.chat.id, '_Solicitação de suporte recebida com sucesso. Em breve nossa equipe entrará em contato._', { parse_mode: 'Markdown' });
            bot.removeListener('message', message);
    })
        .catch((error) => {
          bot.sendMessage(msg.chat.id, `⚠ *${error.message}*`, { parse_mode: 'Markdown' });
        })
    }  
}