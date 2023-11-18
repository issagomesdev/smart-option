import { bot } from "..";

export function show_rules(chatId:number) {
    bot.sendMessage(chatId, `*Quais as vantagens da utilização da automação Smart Option?*
  
Análises precisas, gerenciamento automático de risco, adaptabilidade ao movimento do mercado, proporciona liberdade de tempo, opera de qualquer lugar, personalização de estratégias e alta consistência técnica.`, {parse_mode: 'Markdown'})

bot.sendMessage(chatId, `*Existe risco de perder todo o capital?*
    
Não, nosso sistema utiliza gerenciamento de STOPLOSS que limita todas as contas, em perdas, de no máximo 20%.`, {parse_mode: 'Markdown'})

bot.sendMessage(chatId, `*Como funciona o sistema de Bônus*
    
Todo usuário que desejar indicar novos afiliados, através do seu link de afiliado, passa a receber dois tipos de Bônus: Bônus de ADESÃO/MENSALIDADE e o Bônus de RENTABILIDADE SOBRE A REDE. No Bônus de ADESÃO/MENSALIDADE, o patrocinador recebe de cada indicado, no momento da adesão e nas mensalidades, o percentual referente ao plano contratado, de forma ilimitada, por até três níveis de indicados, podendo chegar até 50%. No Bônus de Rentabilidade sobre a rede, o patrocinador recebe, de cada indicado (até 3), até 3 níveis, o percentual referente ao plano contratado, sobre o lucro total do saldo de toda a sua rede, podendo chegar até 25%.`, {parse_mode: 'Markdown'})

bot.sendMessage(chatId, `*IMPORTANTE:* Os percentuais indicados nos planos são _targets_ (alvos) buscados pela nossa tecnologia. Embora o nosso algoritmo avançado apresente alta consistência técnica, a alta volatilidade e dinâmica do mercado de renda variável não possibilitam promessas ou garantias de ganhos. _A negociação no mercado de renda variável envolve riscos, portanto perdas ou ganhos passados não são garantias de perdas ou rendimentos futuros._`, {parse_mode: 'Markdown'})

}