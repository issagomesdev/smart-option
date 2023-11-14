
import { callback } from "./index";
import { bot } from "..";
import  { _return } from "../components/mainMenu";

const questions:Array<string> = [
    'Nome Completo',
    'Telefone',
    'Endereço',
    'Banco',
    'Agência',
    'Conta',
    'Código Pix'
  ];

let current_field:number = 0;
let answers:any = {};
let field_correction:string|null = "";

export async function register_instructions(chatId:number) {
    await bot.sendMessage(chatId, 'Para realizar seu cadastro em nosso sistema, digite corretamente a resposta para os seguintes campos', {
        reply_markup: _return,
      });
      await bot.sendMessage(chatId, questions[current_field] + ":");
}

export async function fields(msg:any) {
    if(msg.text !== "VOLTAR AO MENU PRINCIPAL"){
        if(field_correction){
            answers[field_correction] = msg.text;
            field_correction = null;
            confirm_fields(msg.chat.id)
        } else {
            answers[current_field] = msg.text;
            if (current_field < questions.length - 1) {
                current_field++;
                if(current_field == 3) await bot.sendMessage(msg.chat.id, "Para terminar, agora responda com seus dados bancários");
                await bot.sendMessage(msg.chat.id, questions[current_field] + ":");
            } else {
                confirm_fields(msg.chat.id)
            }
        } 
    } else {
        current_field = 0;
        answers = {};
    }
}

export async function register_callbacks(query:any) {
    const params:any = new URLSearchParams(query.data)
        if(params.get("for") == "confirm-user-infos"){
            if(params.get("choice") == "yes"){
                await bot.sendMessage(query.message.chat.id, 'Cadastro realizado com sucesso! ✅');
                current_field = 0;
                answers = {};
                return;
            } else {
                await bot.sendMessage(query.message.chat.id, "qual informação deseja corrigir?");
                await bot.sendMessage(query.message.chat.id, "Tudo", callback([{ text: "Editar", callback_data: `choice=all&for=correction-user-infos`}]));
                questions.forEach(async(question, index) => {
                    await bot.sendMessage(query.message.chat.id, question, callback([{ text: "Editar", callback_data: `choice=${index}&for=correction-user-infos`}]));
                });
                
            }
        }

        if(params.get("for") == "correction-user-infos"){
            if(params.get("choice") == "all"){
                current_field = 0;
                await bot.sendMessage(query.message.chat.id, 'Para realizar seu cadastro em nosso sistema, digite corretamente a resposta para os seguintes campos');
                await bot.sendMessage(query.message.chat.id, questions[current_field] + ":");
            } else {
                await bot.sendMessage(query.message.chat.id, "Para realizar seu cadastro em nosso sistema, digite novamente o valor do campo " + questions[params.get("choice")] + ":");
                field_correction = params.get("choice");
            }
        }
}

function show_answers() {
    const response = questions.map(function(question, index) {
        return question+': '+answers[index]
    });

    return response.join('\n');
}

async function confirm_fields(chatId:number) {
    await bot.sendMessage(chatId, 'Verifique atentamente suas informações abaixo e confirme se tudo foi inserido corretamente');
    await bot.sendMessage(chatId, show_answers());
    await bot.sendMessage(chatId, "Confirma?", callback([{ text: '✅ SIM', callback_data: "choice=yes&for=confirm-user-infos"}, { text: '❌ NÃO', callback_data: "choice=no&for=confirm-user-infos" }]));
}