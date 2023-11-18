
import { AuthenticationService } from "../../services/bot/auth.service";
import { callback } from "./index";
import  { _return } from "../components/mainMenu";
import  { return_ } from "../components/auth";
import { bot } from "..";

let email:string;
let pass:string;

export async function login_instructions(chatId:number){
    await bot.sendMessage(chatId, 'Para realizar login em nosso sistema, digite corretamente seu', {
       reply_markup: await _return(chatId),
     });
     await bot.sendMessage(chatId, "Email:");

}

export async function login(msg:any){
    if(msg.text !== "VOLTAR AO MENU PRINCIPAL" && msg.text !== "VOLTAR" ){
        if(!email){
            email = msg.text;
            await bot.sendMessage(msg.chat.id, "Senha:");
        } else if(!pass){
            pass = msg.text;
        } 
        
        if(email && pass){
            await bot.sendMessage(msg.chat.id, 'Você está a um passo de realizar login com essas credencias');
            await bot.sendMessage(msg.chat.id, `Email: ${email}\nSenha: ${pass}`, callback([{ text: 'Entrar', callback_data: "choice=enter&for=confirm-login-infos"}]));
        }
    } else {
        email = null;
        pass = null;
    }
}

export async function login_callbacks(query:any) {
    const params:any = new URLSearchParams(query.data)
        if(params.get("for") == "confirm-login-infos"){
            if(params.get("choice") == "enter"){
                await AuthenticationService.login(email, pass, query.from.id)
                .then(async(data) => {
                    await bot.sendMessage(query.message.chat.id, `Bem-vindo *${data.name}*!`, { parse_mode: 'Markdown' });
                    return_(query.message.chat.id, query.from.id)
                  })
                  .catch(async(error) => {
                    await bot.sendMessage(query.message.chat.id, `*${error}*`, { parse_mode: 'Markdown' });
                    login_instructions(query.message.chat.id);
                  });
                  email = null;
                  pass = null;
            } 
        }
}