import conn from "../db";
import { v4 as uuidv4 } from 'uuid';
import moment from 'moment';
import { TransactionsService } from "./bot/transactions.service";
import { NetworkService } from "./bot/network.service";

export class DashboardService {

  static async users(){
    try {

        const allUsers:any = (
            await conn.query(`SELECT COUNT(*) as total FROM bot_users`)
        )[0][0].total;

        const activeUsers:any = (
            await conn.query(`SELECT COUNT(*) as total FROM bot_users JOIN users_plans ON bot_users.id = users_plans.user_id WHERE users_plans.status = 1`)
        )[0][0].total;

        const bronzeUsers:any = (
            await conn.query(`SELECT COUNT(*) as total FROM bot_users JOIN users_plans ON bot_users.id = users_plans.user_id WHERE users_plans.status = 1 AND users_plans.product_id = 1`)
        )[0][0].total;

        const silverUsers:any = (
            await conn.query(`SELECT COUNT(*) as total FROM bot_users JOIN users_plans ON bot_users.id = users_plans.user_id WHERE users_plans.status = 1 AND users_plans.product_id = 2`)
        )[0][0].total;

        const goldUsers:any = (
            await conn.query(`SELECT COUNT(*) as total FROM bot_users JOIN users_plans ON bot_users.id = users_plans.user_id WHERE users_plans.status = 1 AND users_plans.product_id = 3`)
        )[0][0].total;

        return { allUsers, activeUsers, bronzeUsers, silverUsers, goldUsers }

    } catch (error) {
      throw error;
    }
  }

  static async balance(user_id:string, product_id:string, interval:string){
    try {

      const [start, end] = interval !== 'all'? interval.split(' - ') : '';

      async function total(type:string = null) {

        const balance:any = (
          await conn.query(`SELECT * FROM balance ${product_id !== 'all'? `JOIN users_plans ON balance.user_id = users_plans.user_id WHERE users_plans.product_id = '${product_id}'` : ''} ${user_id !== 'all'? `WHERE user_id = '${user_id}'` : ''} ${type? `${user_id !== 'all' || product_id !== 'all'? 'AND' : 'WHERE'} origin = '${type}'` : ''} ${interval !== 'all'? `${user_id !== 'all' || product_id !== 'all' || type? 'AND' : 'WHERE'} DATE(created_at) BETWEEN '${start.split('-')[2]+'-'+start.split('-')[1]+'-'+start.split('-')[0]}' AND '${end.split('-')[2]+'-'+end.split('-')[1]+'-'+end.split('-')[0]}'` : ''} ORDER BY created_at`)
        )[0];

        const sum = await Promise.all(
          balance.map(async(item) => {
           return item.type == "sum"? parseFloat(item.value) : - parseFloat(item.value);
          })
        );
      
        const total = sum.reduce((acc, value) => acc + value, 0);

        return total % 1 === 0? total.toFixed(2) : total.toFixed(3);
        
      }

      return [
        {
          name: 'Total na Plataforma (R$)',
          value: await total()
        },
        {
          name: 'Rentabilidade da rede (R$)',
          value: (await total('earnings'))
        },
        {
          name: 'Repasse da rede (R$)',
          value:  (await total('profitability'))
        }
      ];
    } catch (error) {
      throw error;
    }
  }

}