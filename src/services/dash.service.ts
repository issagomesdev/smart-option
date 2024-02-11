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

      const balance:any = (
        await conn.query(`SELECT * FROM balance ${product_id !== 'all'? `JOIN users_plans ON balance.user_id = users_plans.user_id WHERE users_plans.product_id = '${product_id}'` : ''} ${user_id !== 'all'? `WHERE user_id = '${user_id}'` : ''} ${interval !== 'all'? `${user_id !== 'all' || product_id !== 'all'? 'AND' : 'WHERE'} DATE(created_at) BETWEEN '${start.split('-')[2]+'-'+start.split('-')[1]+'-'+start.split('-')[0]}' AND '${end.split('-')[2]+'-'+end.split('-')[1]+'-'+end.split('-')[0]}'` : ''} ORDER BY created_at`)
      )[0];

      const users:any = (
        await conn.query(`SELECT user_id, product_id FROM users_plans WHERE status = '1' ${user_id !== 'all'? `AND user_id = '${user_id}'` : ''} ${product_id !== 'all'? `AND product_id = '${product_id}'` : ''}`)
      )[0];

      async function total() {
        const total = await Promise.all(
          balance.map(async(item) => {
           return item.type == "sum"? parseFloat(item.value) : - parseFloat(item.value);
          })
        );
      
        const res = total.reduce((acc, value) => acc + value, 0);

        return  Math.floor(res * 100) / 100;
      }

      async function earnings() {

        let repassValues = [];

        const totalEarnings = await Promise.all(
          users.map(async (user) => {
            const balance_sum:any = (
              await conn.query(`SELECT * FROM balance WHERE user_id = '${user.user_id}' ${interval !== 'all'? `AND DATE(created_at) BETWEEN '${start.split('-')[2]+'-'+start.split('-')[1]+'-'+start.split('-')[0]}' AND '${end.split('-')[2]+'-'+end.split('-')[1]+'-'+end.split('-')[0]}'` : ''} ORDER BY created_at`)
            )[0];

            let balance:number = 0;

          if(balance_sum && balance_sum.length > 0){
            
            balance_sum.map((item) => {
              balance += item.type == "sum"? parseFloat(item.value) : - parseFloat(item.value)
            });

            balance = Math.floor(balance * 100) / 100;
          }

            const product = (
              await conn.query(`SELECT earnings_monthly FROM products WHERE products.id = '${user.product_id}'`)
            )[0][0];

            const R1 = (
            await conn.query(`SELECT * FROM network WHERE guest_user_id = ${user.user_id} AND level = '1' AND earnings = 1`)
            )[0][0];

            if(R1) {
              const R1IsActive = (
                await conn.query(`SELECT * FROM users_plans WHERE user_id = ${R1.affiliate_user_id} AND status = 1`)
              )[0][0];

              if(R1IsActive) {
                NetworkService.earningsPercentage(R1IsActive.product_id, 'earnings', 1)
                .then(async(prctg) => repassValues.push(((prctg*22 / 100) * Math.floor(((product.earnings_monthly / 100) * balance) * 100) / 100)))
             } 

             const R2 = (
                await conn.query(`SELECT * FROM network WHERE guest_user_id = ${user.user_id} AND level = '2' AND earnings = 1`)
              )[0][0];

              if(R2){
                const R2IsActive = (
                  await conn.query(`SELECT * FROM users_plans WHERE user_id = ${R2.affiliate_user_id} AND status = 1`)
                )[0][0];
  
                if(R2IsActive) {
                  NetworkService.earningsPercentage(R2IsActive.product_id, 'earnings', 1)
                  .then(async(prctg) => repassValues.push(((prctg*22 / 100) * Math.floor(((product.earnings_monthly / 100) * balance) * 100) / 100)))
                } 

                const R3 = (
                  await conn.query(`SELECT * FROM network WHERE guest_user_id = ${user.user_id} AND level = '3' AND earnings = 1`)
                )[0][0];

                if(R3){
                  const R3IsActive = (
                    await conn.query(`SELECT * FROM users_plans WHERE user_id = ${R3.affiliate_user_id} AND status = 1`)
                  )[0][0];
    
                  if(R3IsActive) {
                    NetworkService.earningsPercentage(R3IsActive.product_id, 'earnings', 1)
                    .then(async(prctg) => repassValues.push(((prctg*22 / 100) * Math.floor(((product.earnings_monthly / 100) * balance) * 100) / 100)))
                  } 
                }
              }
            }

              return Math.floor(((product.earnings_monthly / 100) * balance) * 100) / 100;
          })
        );

        const earnings = Math.floor(totalEarnings.reduce((acc, value) => acc + value, 0) * 100) / 100;
        const repass = Math.floor(repassValues.reduce((acc, value) => acc + value, 0) * 100) / 100;;

        return {earnings, repass};
      }

      return [
        {
          name: 'Total na Plataforma (R$)',
          value: await total()
        },
        {
          name: 'Rentabilidade da rede (R$)',
          value: (await earnings()).earnings
        },
        {
          name: 'Repasse da rede (R$)',
          value:  (await earnings()).repass
        }
      ];
    } catch (error) {
      throw error;
    }
  }

}