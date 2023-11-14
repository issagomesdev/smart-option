
import { callback, generatePaymentLink } from "./index";
import  { _return } from "../components/mainMenu";
import { bot } from "..";

let balance:number = 593.54;
let mode:string|null = null;

export async function show_balance(chatId:number, userId:number) {
    await bot.sendMessage(chatId, `Saldo atual: ${balance}`);
}

export async function deposit_instructions(chatId:number, userId:number) {
        await bot.sendMessage(chatId, "Digite corretamente a quantia que deseja depositar, ultilize somente numeros e para separar os centavos use virgula:", {
            reply_markup: _return,
          });
        mode = "deposit";
}

export async function make_deposit(msg:any) {
    if(msg.text !== "VOLTAR AO MENU PRINCIPAL"){
        if(mode == "deposit"){
            if(validate_value(msg.text)){
                await bot.sendMessage(msg.chat.id, `o valor a ser depositado é ${msg.text}`);
                await bot.sendMessage(msg.chat.id, "Confirma?", callback([{ text: '✅ SIM', callback_data: `choice=yes&for=confirm-deposit-value&value=${msg.text}`}, { text: '❌ NÃO', callback_data: `choice=no&for=confirm-deposit-value&value=${msg.text}` }]));
                mode = "confirm-deposit";
            } else {
                await bot.sendMessage(msg.chat.id, "Valor incorreto! digite novamente a quantia que deseja depositar, ultilize somente numeros e para separar os centavos use virgula:");
            } 
        }  
    } else {
        mode = null;
    }
}

export async function deposit_callbacks(query:any) {
    if(mode == "confirm-deposit"){
        const params = new URLSearchParams(query.data);
        if(params.get("for") == "confirm-deposit-value"){
            if(params.get("choice") == "yes"){
                generatePaymentLink(query.message.chat.id);
                mode = null;
            } else {
                await bot.sendMessage(query.message.chat.id, "Para completar seu depósito, digite novamente a quantia que desejada, ultilize somente numeros e para separar os centavos use virgula:");
                mode = "deposit";
            }
        }
    }
}

export async function withdraw_instructions(chatId:number, userId:number) {
    await bot.sendMessage(chatId, `Digite corretamente a quantia que deseja sacar, que deve ser inferior ou igual ao saldo em conta (R$${balance.toString().replace('.', ',')}), ultilize somente numeros e para separar os centavos use virgula:`, {
        reply_markup: _return,
      });
    mode = "withdraw";
}

export async function make_withdraw(msg:any) {
if(msg.text !== "VOLTAR AO MENU PRINCIPAL"){
    if(mode == "withdraw"){
        if(validate_value(msg.text)){
            await bot.sendMessage(msg.chat.id, `o valor a ser sacado é ${msg.text}`);
            await bot.sendMessage(msg.chat.id, "Confirma?", callback([{ text: '✅ SIM', callback_data: `choice=yes&for=confirm-withdraw-value&value=${msg.text}`}, { text: '❌ NÃO', callback_data: `choice=no&for=confirm-withdraw-value&value=${msg.text}` }]));
            mode = "confirm-withdraw";
        } else {
            await bot.sendMessage(msg.chat.id, `Valor incorreto! digite novamente a quantia que deseja sacar, que deve ser inferior ou igual ao saldo em conta (R$${balance.toString().replace('.', ',')}), ultilize somente numeros e para separar os centavos use virgula:`);
        } 
    }  
} else {
    mode = null;
}
}

export async function withdraw_callbacks(query:any) {
if(mode == "confirm-withdraw"){
    const params = new URLSearchParams(query.data);
    if(params.get("for") == "confirm-withdraw-value"){
        if(params.get("choice") == "yes"){
            const value:string|null = params.get("value");
            if(value && parseFloat(value.replace(',', '.')) <= balance){
                await bot.sendMessage(query.message.chat.id, "Por onde deseja receber seu pagamento?", callback([{ text: 'PIX', callback_data: "choice=pix&for=receive-payment"}, { text: 'TED', callback_data: "choice=ted&for=receive-payment" }]));
                mode = "receive-payment";
            } else {
                await bot.sendMessage(query.message.chat.id, `O valor digitado é superior ao saldo em conta (R$${balance.toString().replace('.', ',')}). Para completar seu depósito, digite novamente a quantia que desejada, ultilize somente numeros e para separar os centavos use virgula:`);
                mode = "withdraw";
            }
        } else {
            await bot.sendMessage(query.message.chat.id, "Para completar seu depósito, digite novamente a quantia que desejada, ultilize somente numeros e para separar os centavos use virgula:");
            mode = "withdraw";
        }
    }
}

if(mode == "receive-payment"){
    const params = new URLSearchParams(query.data);
    if(params.get("for") == "receive-payment"){
        if(params.get("choice") == "pix"){
            await bot.sendMessage(query.message.chat.id, "Seu saque PIX está sendo processado, assim que houver uma atualização você será notificado por aqui. Agradecemos por escolher nossos serviços! Se precisar de ajuda ou tiver alguma dúvida, estamos à disposição!");
        } else if(params.get("choice") == "ted") {
            await bot.sendMessage(query.message.chat.id, "Seu saque TED está sendo processado, assim que houver uma atualização você será notificado por aqui. Agradecemos por escolher nossos serviços! Se precisar de ajuda ou tiver alguma dúvida, estamos à disposição!");
        }
        mode = null;
    }
}
}


function validate_value(value:string) {
    var regex = /^\d+(,\d{1,2})?$/;
    return regex.test(value);
  }
