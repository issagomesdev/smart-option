import { NetworkService } from "../../services/bot/network.service";
import { bot } from "..";
var { AsciiTable3, AlignmentEnum  } = require('ascii-table3');



export async function show_network_level(chatId:number, userId:number) {
    
    NetworkService.affiliateNetwork(userId).then((data:any) => {
        let items:any = [];
        
         data.map((item) => {
             items.push([item.name, item.level, `${item.status? "Ativo" : "Inativo"}`]);
         })
 
         var extract = 
         new AsciiTable3("REDE")
         .setHeading('Convidado', 'Nivel', 'Situação')
         .setAlign(2, AlignmentEnum.CENTER)
         .addRowMatrix(items)
         .setStyle("compact");
         
         bot.sendMessage(chatId, `<pre>${extract.toString()}</pre>`, { parse_mode: 'HTML' });
         
     })
     .catch((error) =>{
         bot.sendMessage(chatId, `Erro: *${error.message}*`, { parse_mode: 'Markdown' });
     })
}