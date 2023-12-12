import conn from "../db";
import { v4 as uuidv4 } from 'uuid';
import moment from 'moment';


export class FinancialService {

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

  static async extract(userId:number){
    try {

      const balance:any = (
        await conn.query(`SELECT *, DATE_FORMAT(created_at, '%d/%m/%Y') AS created_at FROM balance WHERE user_id = ${userId} ORDER BY created_at`)
      )[0];

      return {extract: balance, balance: await FinancialService.balance(userId)}
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

  static async withdrawalRequests(userId:number = null){
    try {

      const requests:any = (
        await conn.query(`SELECT *, DATE_FORMAT(created_at, '%d/%m/%Y') AS created_at FROM withdrawals ${userId? `WHERE user_id = ${userId}` : ''} ORDER BY created_at`)
      )[0];

      return requests
    } catch (error) {
      throw error;
    }
  }

}
