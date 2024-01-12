

import { TransactionsService } from "../../services/bot/transactions.service";
import { AuthenticationService } from "../../services/bot/auth.service";
import { callback, generatePaymentLink } from "../components/index";
import  { _return } from "../components/mainMenu";
import { bot } from "..";
import moment from 'moment';

var { AsciiTable3, AlignmentEnum  } = require('ascii-table3');
let mode:string = null;
let transfer_data = {
    value: '',
    email: ''
}

export async function getBalance(userId:number):Promise<number> {

    let balance:any = await TransactionsService.balance(userId)
    return balance
}

export async function show_balance(chatId:number, userId:number) {
    await bot.sendMessage(chatId, `Saldo atual: R$ ${(await getBalance(userId)).toString().replace('.', ',')}`);
}

export async function deposit_instructions(chatId:number, userId:number) {
        await bot.sendMessage(chatId, "Digite corretamente a quantia que deseja depositar, ultilize somente numeros e para separar os centavos use virgula:", {
            reply_markup: await _return(chatId, true),
          });
        mode = "deposit";
}

export async function make_deposit(msg:any) {
    if(msg.text !== "🔄 VOLTAR AO MENU FINANCEIRO"){
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
                generatePaymentLink(query.message.chat.id, parseFloat(params.get("value").replace(',', '.')));
                mode = null;
            } else {
                await bot.sendMessage(query.message.chat.id, "Para completar seu depósito, digite novamente a quantia que desejada, ultilize somente numeros e para separar os centavos use virgula:");
                mode = "deposit";
            }
        }
    }
}

export async function depositRequests(userId:number) {
    TransactionsService.checkoutsRequests(userId, "deposit").then(data => {
       let items:any = [];
        data.map((item) => {
            items.push([`${item.value}`, `${item.status == "PENDING"? "Pendente" : item.status == "AUTHORIZED"? "Pre-Autorizado" : item.status == "PAID"? "Concluído" : item.status == "IN_ANALYSIS"? "Em análise" : item.status == "DECLINED"? "Recusado" : item.status == "CANCELED"? "Cancelado" : "Pendente"}`, `${moment(item.created_at).format('DD/MM/YY HH:mm')}`]);
        })

        var extract = 
        new AsciiTable3("Solicitações De Depósito")
        .setHeading('Valor', 'Status', 'Data')
        .setAlign(3, AlignmentEnum.CENTER)
        .addRowMatrix(items)
        .setStyle("compact");
        
        bot.sendMessage(userId, `<pre>${extract.toString()}</pre>`, { parse_mode: 'HTML' });
        
    })
    .catch((error) =>{
        bot.sendMessage(userId, `Erro: *${error.message}*`, { parse_mode: 'Markdown' });
    })
}

export async function withdrawal_instructions(chatId:number, userId:number) {
    await bot.sendMessage(chatId, `Digite corretamente a quantia que deseja sacar, que deve ser inferior ou igual ao saldo em conta (R$ ${(await getBalance(userId)).toString().replace('.', ',')}), ultilize somente numeros e para separar os centavos use virgula:`, {
        reply_markup: await _return(chatId, true),
      });
    mode = "withdrawal";
}

export async function make_withdrawal(msg:any) {
if(msg.text !== "🔄 VOLTAR AO MENU FINANCEIRO"){
    if(mode == "withdrawal"){
        if(validate_value(msg.text)){
            await bot.sendMessage(msg.chat.id, `o valor a ser sacado é ${msg.text}`);
            await bot.sendMessage(msg.chat.id, "Confirma?", callback([{ text: '✅ SIM', callback_data: `choice=yes&for=confirm-withdrawal-value&value=${msg.text}`}, { text: '❌ NÃO', callback_data: `choice=no&for=confirm-withdrawal-value&value=${msg.text}` }]));
            mode = "confirm-withdrawal";
        } else {
            await bot.sendMessage(msg.chat.id, `Valor incorreto! digite novamente a quantia que deseja sacar, que deve ser inferior ou igual ao saldo em conta (R$ ${(await getBalance(msg.from.id)).toString().replace('.', ',')}), ultilize somente numeros e para separar os centavos use virgula:`);
        } 
    }  
} else {
    mode = null;
}
}

export async function withdrawal_callbacks(query:any) {
if(mode == "confirm-withdrawal"){
    const params = new URLSearchParams(query.data);
    if(params.get("for") == "confirm-withdrawal-value"){
        if(params.get("choice") == "yes"){
            const value:string = params.get("value");
            if(value && parseFloat(value.replace(',', '.')) <= await getBalance(query.message.chat.id)){
                TransactionsService.newWithdrawalRequests(query.message.chat.id, parseFloat(value.replace(',', '.'))).then(() => {
                    bot.sendMessage(query.message.chat.id, "Seu pedido de saque está sendo analisado pela nossa equipe, acompanhe o andamento em *Solicitações de saque* dentro do menu financeiro.", { parse_mode: 'Markdown' });
                })
                .catch((error) =>{
                    bot.sendMessage(query.message.chat.id, `Erro: *${error.message}*`, { parse_mode: 'Markdown' });
                })
            } else {
                await bot.sendMessage(query.message.chat.id, `O valor digitado é superior ao saldo em conta (R$ ${(await getBalance(query.message.chat.id)).toString().replace('.', ',')}). Para completar seu depósito, digite novamente a quantia que desejada, ultilize somente numeros e para separar os centavos use virgula:`);
                mode = "withdrawal";
            }
        } else {
            await bot.sendMessage(query.message.chat.id, "Para completar seu depósito, digite novamente a quantia que desejada, ultilize somente numeros e para separar os centavos use virgula:");
            mode = "withdrawal";
        }
    }
}

}

export async function withdrawalRequests(userId:number) {
    TransactionsService.withdrawalRequests(userId).then(data => {
        let items:any = [];
         data.map((item) => {
             items.push([`${item.value}`, `${item.status == "pending"? "Pendente" : item.status == "authorized"? "Autorizado" : item.status == "refused"? "Rejeitado" : "Pendente"}`, `${moment(item.created_at).format('DD/MM/YY HH:mm')}`]);
         })
 
         var extract = 
         new AsciiTable3("Solicitações De Saques")
         .setHeading('Valor', 'Status', 'Data')
         .setAlign(3, AlignmentEnum.CENTER)
         .addRowMatrix(items)
         .setStyle("compact");
         
         bot.sendMessage(userId, `<pre>${extract.toString()}</pre>`, { parse_mode: 'HTML' });
        
    })
    .catch((error) =>{
        bot.sendMessage(userId, `Erro: *${error.message}*`, { parse_mode: 'Markdown' });
    })
}

export async function transfer_instructions(chatId:number, userId:number) {
    await bot.sendMessage(chatId, "Digite corretamente a quantia que deseja transferir, ultilize somente numeros e para separar os centavos use virgula:", {
        reply_markup: await _return(chatId, true),
      });
    mode = "transfer-value";
}

export async function make_transfer(msg:any) {
    if(msg.text !== "🔄 VOLTAR AO MENU FINANCEIRO"){
        if(mode == "transfer-value"){
            if(validate_value(msg.text)){
                if(parseFloat(msg.text.replace(',', '.')) <= await getBalance(msg.from.id)){
                    transfer_data.value = msg.text;
                    mode = "transfer-email"
                    await bot.sendMessage(msg.chat.id, "Agora informe o e-mail do destinatário para o qual deseja realizar a transferência");
                } else {
                    await bot.sendMessage(msg.chat.id, `O valor digitado é superior ao saldo em conta (R$ ${(await getBalance(msg.from.id)).toString().replace('.', ',')}). Para completar sua transferência, digite novamente a quantia que desejada, ultilize somente numeros e para separar os centavos use virgula:`);
                }
            } else {
                await bot.sendMessage(msg.chat.id, "Valor incorreto! digite novamente a quantia que deseja transferir, ultilize somente numeros e para separar os centavos use virgula:");
            } 
        } else if(mode == "transfer-email"){
            AuthenticationService.existingUser(msg.text)
            .then(async() => {
                transfer_data.email = msg.text;
                mode = "confirm-transfer";
                
                await bot.sendMessage(msg.chat.id, 'Você está a um passo de realizar a transferência!');
                await bot.sendMessage(msg.chat.id, `Valor: R$ ${transfer_data.value.replace('.', ',')}\nEmail: ${transfer_data.email}`, callback([{ text: 'Confirmar', callback_data: "choice=confirm&for=confirm-transfer-infos"}, { text: 'Cancelar', callback_data: "choice=cancel&for=confirm-transfer-infos"}]));

            }).catch (async(error) => {
                await bot.sendMessage(msg.chat.id, `${error.message}, insira novamente o e-mail do destinatário para o qual deseja realizar a transferência`);
            })
        }
    } else {
        mode = null;
        transfer_data = {
            value: '',
            email: ''
        }
    }
}

export async function transfer_callbacks(query:any) {
    if(mode == "confirm-deposit"){
        const params = new URLSearchParams(query.data);
        if(params.get("for") == "confirm-deposit-value"){
            if(params.get("choice") == "yes"){
                generatePaymentLink(query.message.chat.id, parseFloat(params.get("value").replace(',', '.')));
                mode = null;
            } else {
                await bot.sendMessage(query.message.chat.id, "Para completar seu depósito, digite novamente a quantia que desejada, ultilize somente numeros e para separar os centavos use virgula:");
                mode = "deposit";
            }
        }
    }
}

export async function extract(userId:number) {
    TransactionsService.extract(userId).then(data => {
       let items:any = [];
        data.map((item) => {
            items.push([`${item.type == "sum"? "+" : "-"}${item.value}`, `${item.origin == "deposit"? "Depósito" : item.origin == "withdrawal"? "Saque" : item.origin == "subscription"? `${item.type == "sum"? `B.A.#${item.reference_id}` : 'Adesão'}` : item.origin == "tuition"? `${item.type == "sum"? `B.M.#${item.reference_id}` : 'Mensalidade'}` : item.origin == "earnings"? "Rentabilidade": item.origin == "profitability"? `B.R.#${item.reference_id}` : item.origin == "transfer"? "Transf. entre contas" : item.origin == "admin"? "Transf. Admin" : "Outros"}`, `${moment(item.created_at).format('DD/MM/YY HH:mm')}`]);
        })

        var extract = 
        new AsciiTable3("EXTRATO")
        .setHeading('Valor', 'Origem', 'Data')
        .setAlign(3, AlignmentEnum.CENTER)
        .addRowMatrix(items)
        .setStyle("compact");

        bot.sendMessage(userId, `<pre>${extract.toString()}</pre>`, { parse_mode: 'HTML' });
        
    })
    .catch((error) =>{
        bot.sendMessage(userId, `Erro: *${error.message}*`, { parse_mode: 'Markdown' });
    })
}

export async function subscriptionRequests(userId:number) {
    TransactionsService.checkoutsRequests(userId, "subscription").then(data => {
       let items:any = [];
        data.map(async(item) => {
            items.push([item.name, `${item.status == "PENDING"? "Pendente" : item.status == "AUTHORIZED"? "Pre-Autorizado" : item.status == "PAID"? "Concluído" : item.status == "IN_ANALYSIS"? "Em análise" : item.status == "DECLINED"? "Recusado" : item.status == "CANCELED"? "Cancelado" : "Pendente"}`, `${moment(item.created_at).format('DD/MM/YY HH:mm')}`]);
        })
        var extract = 
        new AsciiTable3("Solicitações De Adesão")
        .setHeading('Plano', 'Status', 'Data')
        .setAlign(3, AlignmentEnum.CENTER)
        .addRowMatrix(items)
        .setStyle("compact");
        
        bot.sendMessage(userId, `<pre>${extract.toString()}</pre>`, { parse_mode: 'HTML' });
        
    })
    .catch((error) =>{
        bot.sendMessage(userId, `Erro: *${error.message}*`, { parse_mode: 'Markdown' });
    })
}

function validate_value(value:string) {
    var regex = /^\d+(,\d{1,2})?$/;
    return regex.test(value);
}
