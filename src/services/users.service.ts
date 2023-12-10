import conn from "../db";
import { SHA1 } from "crypto-js";
import axios from "axios";
import { bot } from "../bot/index"

export class UsersService {

  static async users(): Promise<any> {
    try {
        const users = (
            await conn.query(`SELECT * FROM users`)
        )[0];

        return users;
    } catch (error) {
      throw error;
    }
  }

  static async botUsers(): Promise<any> {
    try {
        const users:any = (
            await conn.query(`SELECT bot_users.id, bot_users.name, bot_users.email, COALESCE(products.name, 'without') as plan, bot_users.telegram_user_id as telegram, DATE_FORMAT(bot_users.created_at, '%d/%m/%Y') AS created_at, users_plans.status FROM bot_users LEFT JOIN users_plans ON bot_users.id = users_plans.user_id LEFT JOIN products ON products.id = users_plans.product_id`)
        )[0];

        for (const user of users) {
          if (user.telegram) {
              user.telegram = (await bot.getChat(user.telegram)).username;
          } else {
            user.telegram = 'off';
          }
        }

        return users;
        
    } catch (error) {
      throw error;
    }
  }

  static async updateUser(user:any): Promise<any> {
    console.log(user)
    try {
      await conn.query(`UPDATE users SET name='${user.name}',surname='${user.surname}',email='${user.email}' WHERE id = ${user.id}`)

        return { status: true };
    } catch (error) {
      throw error;
    }
  }

  static async updatePass(data:any): Promise<any> {
    try {

      const user = (
        await conn.query(`SELECT password FROM users where id = ${data.userId}`)
    )[0][0];

			if (user.password != SHA1(data.currentPassword)) throw Error("A senha atual inserida não corresponde à senha da conta em questão.");

      await conn.query(`UPDATE users SET password='${SHA1(data.newPassword)}' WHERE id = ${data.userId}`)

      return { status: true };
    } catch (error) {
      throw error;
    }
  }

}
