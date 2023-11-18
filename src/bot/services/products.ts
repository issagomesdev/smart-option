
import { callback, generatePaymentLink } from "./index";
import { bot } from "..";
import  { _return } from "../components/mainMenu";
 
export const plans:any = {
  bronze: `
  🥉Smart Bronze (até 5% ao mês) – R$ 97,00

  Bônus de ADESÃO (Ilimitado)
  ╔═════════╗
  ║ Nível 1- 30% 
  ║ Nível 2- 7%     ╠ 40% 💵
  ║ Nível 3- 3%  
  ╚═════════╝
  
  Bônus de RENTABILIDADE (até 3 afiliados por nível)
  ╔═════════════════╗
  ║ Nível 1- (2,33% * 3) = 7%  
  ║ Nível 2- (1,66% * 3) = 5%     ╠ 15% 💵
  ║ Nível 3- (1,00% * 3) = 3%   
  ╚═════════════════╝
  `,

  silver: `
  🥈Smart silver (até 7% ao mês) – R$ 197,00

  Bônus de ADESÃO (Ilimitado)
  ╔═════════╗
  ║ Nível 1- 33%  
  ║ Nível 2- 8%     ╠ 45% 💵
  ║ Nível 3- 4% 
  ╚═════════╝
  
  Bônus de RENTABILIDADE (até 3 afiliados por nível)
  ╔═════════════════╗
  ║ Nível 1- (3,33% * 3) = 9%  
  ║ Nível 2- (2,33% * 3) = 7%     ╠ 20% 💵
  ║ Nível 3- (1,33% * 3) = 4%   
  ╚═════════════════╝
  `,

  gold: `
  🥇Smart gold (até 10% ao mês) – R$ 297,00

  Bônus de ADESÃO (Ilimitado)
  ╔═════════╗
  ║ Nível 1 - 35%  
  ║ Nível 2 - 10%  ╠ 50% 💵
  ║ Nível 3 - 5%  
  ╚═════════╝
  
  Bônus de RENTABILIDADE (até 3 afiliados por nível)
  ╔═════════════════╗
  ║ Nível 1- (4,00% * 3) = 12%  
  ║ Nível 2- (2,66% * 3) = 8%     ╠ 25% 💵
  ║ Nível 3- (1,66% * 3) = 5%   
  ╚═════════════════╝
  `,

  advanced_management: `
  🤖 Smart Bot – R$197,00 (MENSAL)
  Smart Bot – R$1.297,00 (VITALÍCIO)
  • Gerenciamento avançado.
  • Analisa mais de 17 estratégias e
  encontra as melhores oportunidades.
  • Operações automatizadas.
  • Opera no mercado aberto e OTC.
  • Stop WIN/LOSS.
  • Martin Gale e Soros.
  • Mais de 90% de assertividade.
  `,

  banking_leverage: `
  🎰 Alavancagem de banca:
  
  Aumente em até 5 vezes o valor de sua
  banca em uma sessão individual com um
  Trader de nossa equipe.

  *Embora nossa Equipe tenha um
  histórico de êxito nas operações,
  o mercado de renda variável não
  possibilita garantias que ganhos
  passados representarão resultados
  futuros.
  `,
};

export async function to_go_back(msg:any) {
  if(msg.text == "VOLTAR AO MENU PRINCIPAL"){
  }
}

export async function choose_services(chatId:number) {
    await bot.sendMessage(chatId, "Escolha um de nossos serviços abaixo: ", {
      reply_markup: await _return(chatId),
    });
    await bot.sendMessage(chatId, plans.bronze, callback([{ text: 'COMPRAR', callback_data: "choice=bronze&for=choose-plan" }]));
    await bot.sendMessage(chatId, plans.silver, callback([{ text: 'COMPRAR', callback_data: "choice=silver&for=choose-plan" }]));
    await bot.sendMessage(chatId, plans.gold, callback([{ text: 'COMPRAR', callback_data: "choice=gold&for=choose-plan" }]));
    await bot.sendMessage(chatId, plans.advanced_management, callback([{ text: 'COMPRAR', callback_data: "choice=advanced_management&for=choose-plan" }]));
    await bot.sendMessage(chatId, plans.banking_leverage, callback([{ text: 'COMPRAR', callback_data: "choice=banking_leverage&for=choose-plan" }]));
    
}

async function confirm_chosen_plan(chatId:number, plan:string) {
    await bot.sendMessage(chatId, "O plano escolhido foi:");
    await bot.sendMessage(chatId, plans[plan]);
    await bot.sendMessage(chatId, "Ao clicar em sim, você automaticamente aceita os termos e condições referente a adesão do serviço de sua escolha.");
    await bot.sendMessage(chatId, "Confirma?", callback([{ text: '✅ SIM', callback_data: "choice=yes&for=confirm-choose-plan"}, { text: '❌ NÃO', callback_data: "choice=no&for=confirm-choose-plan" }]));

}

export function products_callbacks(query:any){
  const params:any = new URLSearchParams(query.data)
  if(params.get("for") == "choose-plan"){
    confirm_chosen_plan(query.message.chat.id, params.get("choice"))
  } else if(params.get("for") == "confirm-choose-plan"){
    if(params.get("choice") == "yes"){
      generatePaymentLink(query.message.chat.id)
      bot.removeListener('callback_query', products_callbacks);
      return;
    } else {
      choose_services(query.message.chat.id)
    }
  }
    
}