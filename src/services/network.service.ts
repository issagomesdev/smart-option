import conn from "../db";
import { v4 as uuidv4 } from 'uuid';
import moment from 'moment';


export class NetworkService {

  static async network(userId:number){
    try {
          
        const guests = (
        await conn.query(`SELECT bot_users.id, bot_users.name, network.level, CASE WHEN users_plans.status = 1 THEN 1 ELSE 0 END AS status FROM bot_users INNER JOIN network ON bot_users.id = network.guest_user_id LEFT JOIN users_plans ON bot_users.id = users_plans.user_id WHERE network.affiliate_user_id = ${userId} ORDER BY level;`)
        )[0];

        const affiliates = (
        await conn.query(`SELECT bot_users.id, bot_users.name, network.level, CASE WHEN users_plans.status = 1 THEN 1 ELSE 0 END AS status FROM bot_users INNER JOIN network ON bot_users.id = network.affiliate_user_id LEFT JOIN users_plans ON bot_users.id = users_plans.user_id WHERE network.guest_user_id = ${userId} ORDER BY level;`)
        )[0];

        return { guests, affiliates }
    } catch (error) {
      throw error;
    }
  }

}