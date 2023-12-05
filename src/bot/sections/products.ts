import { getBalance } from "./balance";
import { callback, generatePaymentLink } from "../components/index";
import { bot } from "..";
import  { _return } from "../components/mainMenu";
import { ProductsService } from "../../services/bot/products.service";
import { RequestsService } from "../../services/bot/requests.service";
import { TransactionsService } from "../../services/bot/transactions.service";

 
export let plans:any = []
let chosenPlan:number;

ProductsService.products().then((data)=> {
  plans = data;
})

export async function choose_services(chatId:number) {
    await bot.sendMessage(chatId, "Escolha um de nossos serviços abaixo: ", {
      reply_markup: await _return(chatId),
    });
      for(let i = 0; i < plans.length; i++) {  
        await bot.sendMessage(chatId, plans[i].description, callback([{ text: 'COMPRAR', callback_data: `choice=${i}&for=choose-plan` }])); 
      }
    
}

async function confirm_chosen_plan(chatId:number) {
    await bot.sendMessage(chatId, "O plano escolhido foi:");
    await bot.sendMessage(chatId, plans[chosenPlan].description);
    await bot.sendMessage(chatId, "Ao clicar em sim, você automaticamente aceita os termos e condições referente a adesão do serviço de sua escolha.");
    await bot.sendMessage(chatId, "Confirma?", callback([{ text: '✅ SIM', callback_data: "choice=yes&for=confirm-choose-plan"}, { text: '❌ NÃO', callback_data: "choice=no&for=confirm-choose-plan" }]));

}

export async function products_callbacks(query:any){
  const params:any = new URLSearchParams(query.data)


  if(params.get("for") == "choose-plan"){
    chosenPlan = Number(params.get("choice"));
    confirm_chosen_plan(query.message.chat.id)
  } else if(params.get("for") == "confirm-choose-plan"){

    if(params.get("choice") == "yes"){

      if(plans[chosenPlan].purchase_type == "auto"){

        if(await TransactionsService.balance(query.message.chat.id) > 0){

          if(await TransactionsService.balance(query.message.chat.id) >= plans[chosenPlan].price) {

            await bot.sendMessage(query.message.chat.id, `Seu saldo atual é de ${(await TransactionsService.balance(query.message.chat.id)).toString().replace('.', ',')}, suficiente para cobrir o custo do produto selecionado. Você tem a opção de utilizar esse saldo para abater o valor ou gerar um link de pagamento para cobrir o valor total da compra!`, callback([{ text: 'Utilizar Saldo', callback_data: "choice=balance&for=choose-balance-link"}, { text: 'Gerar Link de Pagamento', callback_data: "choice=link&for=choose-balance-link" }]));
            
          } else {

            await bot.sendMessage(query.message.chat.id, `Seu saldo atual é de R$ ${(await TransactionsService.balance(query.message.chat.id)).toString().replace('.', ',')}, suficiente para cobrir parte do custo do produto selecionado. Você tem a opção de fazer um depósito no valor restante e descontar diretamente do seu saldo ou gerar um link de pagamento para cobrir o valor total da compra!`, callback([{ text: 'Realizar Depósito', callback_data: "choice=deposit&for=choose-balance-link"}, { text: 'Gerar Link de Pagamento', callback_data: "choice=link&for=choose-balance-link" }]));

          }

        } else {
          generatePaymentLink(query.message.chat.id, plans[chosenPlan].price, plans[chosenPlan]);
        }
      } else {

        RequestsService.request('service', query.message.chat.id, plans[chosenPlan].id)
        .then(() => bot.sendMessage(query.message.chat.id, '_Pedido realizado com sucesso. Em breve nosso suporte entrará em contato._', { parse_mode: 'Markdown' }))
        .catch((error) =>{
          bot.sendMessage(query.message.chat.id, `Erro: *${error.message}*`, { parse_mode: 'Markdown' });
        })
        
      }
      return;
    } else {
      choose_services(query.message.chat.id)
    }
    
  } else if(params.get("for") == "choose-balance-link") {

    if(params.get("choice") == "link") {
      generatePaymentLink(query.message.chat.id, plans[chosenPlan].price, plans[chosenPlan]);
    } else if(params.get("choice") == "deposit") {
      generatePaymentLink(query.message.chat.id, (plans[chosenPlan].price - await TransactionsService.balance(query.message.chat.id)));
    }  else if(params.get("choice") == "balance") {
      TransactionsService.subscriptionWithBalance(query.message.chat.id, plans[chosenPlan]);
      await bot.sendMessage(query.message.chat.id, '_O produto selecionado foi adquirido com sucesso!_', { parse_mode: 'Markdown' });
    }
    
  }
    
}