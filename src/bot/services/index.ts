import { bot } from "..";

export function callback(call:any) {
    return {
      reply_markup: {
        inline_keyboard: [call],
      },
    };
}

export async function generatePaymentLink(chatId:number) {
  await bot.sendMessage(chatId, 'Você deu um passo importante para aproveitar ao máximo nossos serviços incríveis! 🚀 Para concluir a compra, clique no link de pagamento abaixo: ');
  await bot.sendMessage(chatId, 'https://exemplo-de-link.com');
  await bot.sendMessage(chatId, 'Escolha a opção que mais se adequa a você: PIX, débito, crédito ou boleto. Após efetuar o pagamento, aguarde a confirmação que pode levar alguns instantes. Assim que o pagamento for confirmado, seu saldo será atualizado automaticamente. Agradecemos por escolher nossos serviços! Se precisar de ajuda ou tiver alguma dúvida, estamos à disposição!');
}