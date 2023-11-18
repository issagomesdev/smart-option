
import { callback } from "./index";
import { bot } from "..";
import  { _return } from "../components/mainMenu";
import { RegisterService } from "../../services/bot/register.service";

const questions:Array<any> = [
    {
        field: 'name',
        text: 'Nome Completo',
    },
    {
        field: 'email',
        text: 'Email',
    },
    {
        field: 'password',
        text: 'Senha',
    },
    {
        field: 'phone_number',
        text: 'Telefone',
    },
    {
        field: 'adress',
        text: 'Endereço',
    },
    {
        field: 'bank_name',
        text: 'Banco',
    },
    {
        field: 'bank_agency_number',
        text: 'Agência',
    },
    {
        field: 'bank_account_number',
        text: 'Conta',
    },
    {
        field: 'pix_code',
        text: 'Código Pix',
    },
  ];

let current_field:number = 0;
let answers:any = {};
let field_correction:number|null = null;

export async function register_instructions(chatId:number) {
     bot.sendMessage(chatId, 'Para realizar seu cadastro em nosso sistema, digite corretamente a resposta para os seguintes campos', {
        reply_markup: await _return(chatId),
      });
      await bot.sendMessage(chatId, questions[current_field].text + ":");
}

export async function fields(msg:any) {
    if(msg.text !== "VOLTAR AO MENU PRINCIPAL" && msg.text !== "VOLTAR" ){
        if(field_correction || field_correction == 0){
            answers[questions[field_correction].field] = msg.text;
            field_correction = null;
            confirm_fields(msg.chat.id)
        } else {
            answers[questions[current_field].field] = msg.text;
            if (current_field < questions.length - 1) {
                current_field++;
                if(current_field == 5) await bot.sendMessage(msg.chat.id, "Para terminar, agora responda com seus dados bancários");
                await bot.sendMessage(msg.chat.id, questions[current_field].text + ":");
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
                RegisterService.registerUser(answers, query.message.chat.id)
                .then(() => {
                    bot.sendMessage(query.message.chat.id, 'Cadastro realizado com sucesso! ✅');
                    current_field = 0;
                    answers = {};
                  })
                  .catch(async(error) => {
                    await bot.sendMessage(query.message.chat.id, `*${error}*`, { parse_mode: 'Markdown' });
                    await bot.sendMessage(query.message.chat.id, "Para realizar seu cadastro em nosso sistema, digite novamente o valor do campo " + questions[1].text + ":");
                    field_correction = 1
                  });
                return;
            } else {
                await bot.sendMessage(query.message.chat.id, "qual informação deseja corrigir?");
                await bot.sendMessage(query.message.chat.id, "Tudo", callback([{ text: "Editar", callback_data: `choice=all&for=correction-user-infos`}]));
                questions.forEach(async(question, index) => {
                    await bot.sendMessage(query.message.chat.id, question.text, callback([{ text: "Editar", callback_data: `choice=${index}&for=correction-user-infos`}]));
                });
                
            }
        }

        if(params.get("for") == "correction-user-infos"){
            if(params.get("choice") == "all"){
                current_field = 0;
                await bot.sendMessage(query.message.chat.id, 'Para realizar seu cadastro em nosso sistema, digite corretamente a resposta para os seguintes campos');
                await bot.sendMessage(query.message.chat.id, questions[current_field].text + ":");
            } else {
                await bot.sendMessage(query.message.chat.id, "Para realizar seu cadastro em nosso sistema, digite novamente o valor do campo " + questions[Number(params.get("choice"))].text + ":");
                field_correction = Number(params.get("choice"));
            }
        }
}

function show_answers() {
    const response = questions.map(function(question) {
        return question.text+': '+answers[question.field]
    });

    return response.join('\n');
}

async function confirm_fields(chatId:number) {
    await bot.sendMessage(chatId, 'Verifique atentamente suas informações abaixo e confirme se tudo foi inserido corretamente');
    await bot.sendMessage(chatId, show_answers());
    await bot.sendMessage(chatId, "Confirma?", callback([{ text: '✅ SIM', callback_data: "choice=yes&for=confirm-user-infos"}, { text: '❌ NÃO', callback_data: "choice=no&for=confirm-user-infos" }]));
}