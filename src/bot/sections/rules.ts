import { bot } from "..";

export async function show_rules(chatId:number) {

   await bot.sendMessage(chatId, `*Quais as vantagens da utilização da automação Smart Option?*

Todo usuário, ao aderir a algum Plano, tem direito a 3 benefícios: O Rendimento mensal, o Bônus de adesão/mensalidade e o Bônus de rendimento sobre o lucro da rede.`, {parse_mode: 'Markdown'})

   await bot.sendMessage(chatId, `*Como funciona o sistema de Bônus*

O usuário que indicar novos afiliados, por meio do seu link de afiliado, passa a receber, além do rendimento do seu plano, mais dois tipos de benefícios: o Bônus de ADESÃO/MENSALIDADE e o Bônus de RENTABILIDADE SOBRE A REDE.

No Bônus de ADESÃO/MENSALIDADE, o patrocinador recebe de cada indicado, no momento da adesão e nas mensalidades, o percentual referente ao plano contratado, de forma ilimitada, por até três níveis de indicados, podendo chegar até 50%.

No Bônus de Rentabilidade sobre a rede, o patrocinador recebe, de cada indicado (até 3), por até 3 níveis, o percentual referente ao plano contratado, sobre o lucro total do saldo de toda a sua rede, podendo chegar até 25%.`, {parse_mode: 'Markdown'})

   await bot.sendMessage(chatId, `*Sou obrigado a indicar pessoas para o sistema?*
    
Não. Você pode aderir ao sistema apenas como usuário dos planos de serviços automatizados.`, {parse_mode: 'Markdown'})

   await bot.sendMessage(chatId, `*Há possibilidade de perder todo o capital investido?*
      
Não, nosso algoritmo adota um gerenciamento de risco com "STOPLOSS", que restringe qualquer conta a um máximo de 10% de perdas, em caso de movimentos desfavoráveis do mercado.`, {parse_mode: 'Markdown'})

   await bot.sendMessage(chatId, `*Posso realizar depósitos a qualquer momento?*
      
Sim. Os depósitos são compensados automaticamente após a validação do sistema. `, {parse_mode: 'Markdown'})

   await bot.sendMessage(chatId, `*Posso realizar saques a qualquer momento?*
    
Sim. Em até 72h úteis os saques são efetivados, podendo ocorrer a qualquer momento.`, {parse_mode: 'Markdown'})

   await bot.sendMessage(chatId, `*IMPORTANTE:*  Os percentuais de ganhos indicados nos planos são metas buscados pela nossa tecnologia. Embora o nosso algoritmo avançado apresente alta consistência técnica, a alta volatilidade e dinâmica do mercado de renda variável não possibilitam promessas ou garantias de ganhos. Portanto, os rendimentos mensais são metas aproximadas que podem render “até” o percentual indicado no plano.
   
_A negociação no mercado de renda variável envolve riscos, portanto perdas ou ganhos passados não são garantias de perdas ou rendimentos futuros._

*Contas a partir de 20 mil reais - taxa de serviço de 2% mensal.*`, {parse_mode: 'Markdown'})

}