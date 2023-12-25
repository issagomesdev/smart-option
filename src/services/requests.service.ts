import conn from "../db";
import { v4 as uuidv4 } from 'uuid';
import moment from 'moment';


export class RequestService {

  static async balance(userId:number){
    try {

      const balance:any = (
        await conn.query(`SELECT * FROM balance WHERE user_id = ${userId} ORDER BY created_at`)
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

  static async extract(userId:number, filters:any = null){
    try {

      const balance:any = (
        await conn.query(`SELECT *, DATE_FORMAT(created_at, '%d/%m/%Y %H:%i') AS created_at FROM balance WHERE user_id = ${userId} ${filters? `${filters.value.includes('+')? `AND balance.type = 'sum'`: filters.value.includes('-')? `AND balance.type = 'subtract'` : ''} AND LOWER(balance.value) LIKE LOWER('%${filters.value.match(/[+-]?\d+(\.\d+)?/)? filters.value.match(/[+-]?\d+(\.\d+)?/)[0] : '' }%') ${filters.origin !== 'all'? `AND ${filters.origin == 'deposit'? 'balance.origin = "deposit"' : filters.origin == 'withdraw'? 'balance.origin = "withdraw"' : filters.origin == 'subscription'? 'balance.origin = "subscription" AND balance.type = "subtract"' : filters.origin == 'tuition'? 'balance.origin = "tuition" AND balance.type = "subtract"' : filters.origin == 'earnings'? 'balance.origin = "earnings"' : filters.origin == 'profitability'? 'balance.origin = "profitability"' : filters.origin == 'B.A'? 'balance.origin = "subscription" AND balance.type = "sum"' : filters.origin == 'B.M'? 'balance.origin = "tuition" AND balance.type = "sum"' : '' }` : ''} ${filters.created_at? `AND LOWER(balance.created_at) LIKE LOWER('%${filters.created_at.replace('T', ' ')}%')` : ''}` : '' } ORDER BY created_at`)
      )[0];

      return {extract: balance, balance: await RequestService.balance(userId)}
    } catch (error) {
      throw error;
    }
  }

  static async withdrawalRequests(userId:number = null, filters:any){
    try {

      const requests:any = (
        await conn.query(`SELECT withdrawals.*, DATE_FORMAT(withdrawals.created_at, '%d/%m/%Y %H:%i') AS created_at, bot_users.name FROM withdrawals JOIN bot_users ON withdrawals.user_id = bot_users.id WHERE ${`LOWER(withdrawals.id) LIKE LOWER('%${filters.id}%') AND LOWER(bot_users.name) LIKE LOWER('%${filters.name}%') AND LOWER(withdrawals.value) LIKE LOWER('%${filters.value}%') ${filters.status !== 'all'? `AND withdrawals.status = "${filters.status}"` : ''} ${filters.created_at? `AND LOWER(withdrawals.created_at) LIKE LOWER('%${filters.created_at.replace('T', ' ')}%')` : ''}`} ${userId? `AND withdrawals.user_id = ${userId}` : ''} ORDER BY created_at`)
      )[0];

      return requests
    } catch (error) {
      throw error;
    }
  }

  static async depositsRequests(userId:number = null, filters:any){
    try {
      const requests:any = (
        await conn.query(`SELECT checkouts.*, DATE_FORMAT(checkouts.created_at, '%d/%m/%Y %H:%i') AS created_at, bot_users.name FROM checkouts JOIN bot_users ON checkouts.user_id = bot_users.id WHERE ${`LOWER(checkouts.id) LIKE LOWER('%${filters.id}%') AND LOWER(bot_users.name) LIKE LOWER('%${filters.name}%') AND LOWER(checkouts.value) LIKE LOWER('%${filters.value}%') ${filters.status !== 'all'? `AND checkouts.status = "${filters.status}"` : ''} ${filters.created_at? `AND LOWER(checkouts.created_at) LIKE LOWER('%${filters.created_at.replace('T', ' ')}%')` : ''}`} ${userId? `AND checkouts.user_id = ${userId}` : ''} AND checkouts.type = 'deposit' ORDER BY created_at`)
      )[0];

      return requests
    } catch (error) {
      throw error;
    }
  }

  static async subscriptionsRequests(userId:number = null, filters:any){
    try {
      const requests:any = (
        await conn.query(`SELECT checkouts.*, DATE_FORMAT(checkouts.created_at, '%d/%m/%Y %H:%i') AS created_at, bot_users.name, products.name as product FROM checkouts JOIN bot_users ON checkouts.user_id = bot_users.id LEFT JOIN products ON products.id = checkouts.product_id WHERE ${`LOWER(checkouts.id) LIKE LOWER('%${filters.id}%') AND LOWER(bot_users.name) LIKE LOWER('%${filters.name}%') AND LOWER(checkouts.value) LIKE LOWER('%${filters.value}%') ${filters.status !== 'all'? `AND checkouts.status = "${filters.status}"` : ''} ${filters.product_id !== 'all'? `AND checkouts.product_id = "${filters.product_id}"` : ''} ${filters.created_at? `AND LOWER(checkouts.created_at) LIKE LOWER('%${filters.created_at.replace('T', ' ')}%')` : ''}`} ${userId? `AND checkouts.user_id = ${userId}` : ''} AND checkouts.type = 'subscription' ORDER BY created_at`)
      )[0];

      return requests
    } catch (error) {
      throw error;
    }
  }

  static async supportRequests(userId:number = null, filters:any){
    try {
      console.log(filters)
      const requests:any = (
        await conn.query(`SELECT requests.*, DATE_FORMAT(requests.created_at, '%d/%m/%Y %H:%i') AS created_at, bot_users.name, bot_users.id as user_id, products.name as product FROM requests JOIN bot_users ON requests.user_id = bot_users.id LEFT JOIN products ON products.id = requests.subject WHERE ${`LOWER(requests.id) LIKE LOWER('%${filters.id}%') AND LOWER(bot_users.name) LIKE LOWER('%${filters.name}%') ${filters.type !== 'all'? `AND requests.type = "${filters.type}"` : ''} ${filters.created_at? `AND LOWER(requests.created_at) LIKE LOWER('%${filters.created_at.replace('T', ' ')}%')` : ''}`} ${userId? `AND requests.user_id = ${userId}` : ''} ORDER BY created_at`)
      )[0];

      return requests
    } catch (error) {
      throw error;
    }
  }

  static async resWithdrawal(body:any){
    try {
      
      await conn.query(`UPDATE withdrawals SET status='${body.res? 'authorized': 'refused'}', reply_observation='${body.observation}' WHERE id = '${body.id}'`)
      
      const withdrawal = (
        await conn.query(`SELECT * FROM withdrawals WHERE id = '${body.id}'`)
      )[0][0];

      if(body.res){
        await conn.execute(`INSERT INTO balance(value, user_id, type, origin, reference_id) VALUES ('${withdrawal.value}','${withdrawal.user_id}', 'subtract', 'withdrawal', '${withdrawal.id}')`);
      }

    // const options = {
    //   method: 'POST',
    //   headers: {
    //     accept: 'application/json',
    //     Authorization: `Bearer ${process.env.PAG_TOKEN}`,
    //     'content-type': 'application/json'
    //   },
    //   body: JSON.stringify({
    //     amount: {value: Number(withdrawal.value)*100, currency: 'BRL'},
    //     instrument: {
    //       type: 'PIX',
    //       pix: {key: `${user.pix_code}`, name: `${user.name}`, tax_id: `${user.cpf}`}
    //     },
    //     reference_id: `${withdrawal.id}`,
    //     notification_urls: [`${process.env.API_BASE_PATH}/transactions/res-withdrawal-req/${withdrawal.reference_id}`]
    //   })
    // };
    // const response = await fetch(`${process.env.TRANS_CHK_PATH}/transfers`, options);
    // const data = await response.json();
    } catch (error) {
      console.log(error)
    }
  }
}
