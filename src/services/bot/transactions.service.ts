import conn from "../../db";
import { v4 as uuidv4 } from 'uuid';
import moment from 'moment';
import { NetworkService } from "./network.service";


export class TransactionsService {

  static async balance(telegramId:number = null, earnings:boolean = true, user:any = null){
    try {

      if(telegramId && !user) {
        user = (
          await conn.query(`SELECT * FROM bot_users WHERE telegram_user_id = ${telegramId}`)
        )[0][0];
      }

      const balance:any = (
        await conn.query(`SELECT * FROM balance WHERE user_id = '${user.user_id}' ${!earnings? "AND origin != 'earnings' AND MONTH(created_at) = MONTH(CURDATE())" : ""} ORDER BY created_at`)
      )[0];

      let result:number = 0;

      if(balance && balance.length > 0){
        
        balance.map((item) => {
          result += item.type == "sum"? parseFloat(item.value) : - parseFloat(item.value)
        });

        result = Math.floor(result * 100) / 100;
      }

      return result;
    } catch (error) {
      throw error;
    }
  }

  static async extract(userId:number){
    try {

      const user = (
        await conn.query(`SELECT * FROM bot_users WHERE telegram_user_id = ${userId}`)
      )[0][0];

      const balance:any = (
        await conn.query(`SELECT * FROM balance WHERE user_id = ${user.id} ORDER BY created_at`)
      )[0];

      return balance
    } catch (error) {
      throw error;
    }
  }

  static async checkoutsRequests(userId:number, type:string){
    try {

      const user = (
        await conn.query(`SELECT * FROM bot_users WHERE telegram_user_id = ${userId}`)
      )[0][0];

      const requests:any = (
        await conn.query(`SELECT ${type == 'subscription'? 'checkouts.*, products.name' : '*'} FROM checkouts ${type == 'subscription'? 'JOIN products ON checkouts.product_id = products.id' : ''} WHERE checkouts.user_id = ${user.id} AND checkouts.type = '${type}' ORDER BY created_at`)
      )[0];

      return requests
    } catch (error) {
      throw error;
    }
  }

  static async withdrawalRequests(userId:number){
    try {

      const user = (
        await conn.query(`SELECT * FROM bot_users WHERE telegram_user_id = ${userId}`)
      )[0][0];

      const requests:any = (
        await conn.query(`SELECT * FROM withdrawals WHERE user_id = ${user.id} ORDER BY created_at`)
      )[0];

      return requests
    } catch (error) {
      throw error;
    }
  }

  static async checkout(userId: number, value:number, product:any = null){
    try {

      const user = (
        await conn.query(`SELECT * FROM bot_users WHERE telegram_user_id = '${userId}'`)
      )[0][0];

      const checkout:any = (
        await conn.execute(`INSERT INTO checkouts(reference_id, type, value, user_id, product_id) VALUES ('${uuidv4()}','${product? 'subscription' : 'deposit'}', '${value}', '${user.id}', '${product? product.id : null}')`)
        )[0];

      let item:any;
      
      product? item = { reference_id: `${product.id}`, name: `SMART OPTION E.A. Plano Smart ${product.name}`, quantity: 1, unit_amount: value*100}  : item = { name: `SMART OPTION E.A. Depósito`, quantity: 1, unit_amount: value*100}

      const options = {
        method: 'POST',
        headers: {
          accept: 'application/json',
          'Content-type': 'application/json',
          Authorization: `Bearer ${process.env.PAG_TOKEN}`
        },
        body: JSON.stringify({
          items: [item],
          reference_id: checkout.insertId.toString(),
          payment_notification_urls: [`${process.env.API_BASE_PATH}/transactions/checkout-successful/${checkout.insertId}`]
        })
      };

      const response = await fetch(`${process.env.PAG_CHK_PATH}/checkouts`, options);
      const data = await response.json();

      await conn.query(`UPDATE checkouts SET transaction_id='${data.id}' WHERE id = '${checkout.insertId}'`);
      return data.links.find(link => link.rel == "PAY").href;

    } catch (error) {
      throw error;
    }
  }

  static async finishCheckout(reference_id:string, status:string){
    try {
      const ref_checkout = (
        await conn.query(`SELECT * FROM checkouts WHERE id = '${reference_id}' AND status != '${status}'`)
      )[0][0];

      if(ref_checkout){
        await conn.query(`UPDATE checkouts SET status='${status}' WHERE id = '${ref_checkout.id}'`);

        if(status == "PAID"){

          if(ref_checkout.type == "deposit"){

            await conn.execute(`INSERT INTO balance(value, user_id, type, origin, reference_id) VALUES ('${ref_checkout.value}','${ref_checkout.user_id}', 'sum', '${ref_checkout.type}', '${ref_checkout.id}')`);
            
          } else if(ref_checkout.type == "subscription"){

            const hasPlan = (
              await conn.query(`SELECT * FROM users_plans WHERE user_id = '${ref_checkout.user_id}'`)
            )[0][0];

            if(hasPlan){

              await conn.query(`UPDATE users_plans SET product_id='${ref_checkout.product_id}', status='1', acquired_in='${moment().format('YYYY-MM-DD HH:mm:ss')}', expired_in='${moment().add(1, 'months').format('YYYY-MM-DD HH:mm:ss')}' WHERE user_id = '${ref_checkout.user_id}'`);
              
            } else {
              
              await conn.execute(`INSERT INTO users_plans(user_id, product_id, expired_in) VALUES ('${ref_checkout.user_id}','${ref_checkout.product_id}', '${moment().add(1, 'months').format('YYYY-MM-DD HH:mm:ss')}')`);

            }
  
            NetworkService.networkRepass(ref_checkout.user_id, ref_checkout.value, "subscription");
          }
        }
      }

    } catch (error) {
      throw error;
    }
  }

  static async newWithdrawalRequests(userId: number, value:number){
    try {

      const user = (
        await conn.query(`SELECT * FROM bot_users WHERE telegram_user_id = '${userId}'`)
      )[0][0];

      await conn.execute(`INSERT INTO withdrawals(user_id, value, reference_id) VALUES ('${user.id}', '${value}', '${uuidv4()}')`);

    } catch (error) {
      throw error;
    }
  }

  static async hasWithdrawalPendingRequests(userId: number){
    try {

      const user = (
        await conn.query(`SELECT * FROM bot_users WHERE telegram_user_id = '${userId}'`)
      )[0][0];


      const hasWithdrawal = (
        await conn.query(`SELECT COUNT(*) AS has FROM withdrawals WHERE user_id = ${user.id} AND status = 'pending'`)
      )[0][0];

      return hasWithdrawal.has;
    } catch (error) {
      throw error;
    }
  }

  static async renewTuition(user:any, product:any){
    await conn.execute(`INSERT INTO balance(value, user_id, type, origin) VALUES ('${product.price}','${user.user_id}', 'subtract', 'tuition')`);
			
			await conn.query(`UPDATE users_plans SET product_id='${user.product_id}', status='1', acquired_in='${moment().format('YYYY-MM-DD HH:mm:ss')}', expired_in='${moment().add(1, 'months').format('YYYY-MM-DD HH:mm:ss')}' WHERE user_id = '${user.user_id}'`);
  }

  static async subscriptionWithBalance(userId: number, product:any){

    const user = (
      await conn.query(`SELECT * FROM bot_users WHERE telegram_user_id = ${userId}`)
    )[0][0];

    await conn.execute(`INSERT INTO balance(value, user_id, type, origin) VALUES ('${product.price}','${user.id}', 'subtract', 'subscription')`);

    const hasPlan = (
      await conn.query(`SELECT * FROM users_plans WHERE user_id = '${user.id}'`)
    )[0][0];

    if(hasPlan){

      await conn.query(`UPDATE users_plans SET product_id='${product.id}', status='1', acquired_in='${moment().format('YYYY-MM-DD HH:mm:ss')}', expired_in='${moment().add(1, 'months').format('YYYY-MM-DD HH:mm:ss')}' WHERE user_id = '${user.id}'`);
      
    } else {
      
      await conn.execute(`INSERT INTO users_plans(user_id, product_id, expired_in) VALUES ('${user.id}','${product.id}', '${moment().add(1, 'months').format('YYYY-MM-DD HH:mm:ss')}')`);

    }

    
  }

}
