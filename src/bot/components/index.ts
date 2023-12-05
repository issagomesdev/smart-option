import { bot } from "..";
import { TransactionsService } from "../../services/bot/transactions.service";


export function callback(call:any) {
    return {
      reply_markup: {
        inline_keyboard: [call],
      },
    };
}

export async function generatePaymentLink(userId: number, value:number, product:any = null) {
  TransactionsService.checkout(userId, value, product).then(async(res) => {
  await bot.sendMessage(userId, 'Você deu um passo importante para aproveitar ao máximo nossos serviços incríveis! 🚀 Para concluir a compra, clique no link de pagamento abaixo: ');
  await bot.sendMessage(userId, res);
  await bot.sendMessage(userId, 'Escolha a opção que mais se adequa a você: PIX, débito, crédito ou boleto. Após efetuar o pagamento, aguarde a confirmação que pode levar alguns instantes. Assim que o pagamento for confirmado, seu saldo será atualizado automaticamente. Agradecemos por escolher nossos serviços! Se precisar de ajuda ou tiver alguma dúvida, estamos à disposição!');
  })
  .catch((error) =>{
    bot.sendMessage(userId, `Erro: *${error.message}*`, { parse_mode: 'Markdown' });
  })

}