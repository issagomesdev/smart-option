import conn from "../db";
import { SHA1 } from "crypto-js";
import axios from "axios";
import { bot } from "../bot/index"
import { TransactionsService } from "./bot/transactions.service";

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

  static async updateUser(user:any): Promise<any> {
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

  static async botUsers(search:string, filters:any = null): Promise<any> {
    try {

        const users:any = (
        await conn.query(`SELECT bot_users.id, bot_users.name, bot_users.email, COALESCE(products.name, 'without') as plan, bot_users.telegram_user_id as telegram, DATE_FORMAT(bot_users.created_at, '%d/%m/%Y') AS created_at, bot_users.is_active, users_plans.status FROM bot_users LEFT JOIN users_plans ON bot_users.id = users_plans.user_id LEFT JOIN products ON products.id = users_plans.product_id ${search !== 'all' ? `WHERE bot_users.id = '${search}' OR LOWER(bot_users.name) LIKE LOWER('%${search}%')` : ''}
        ${filters? `WHERE LOWER(bot_users.id) LIKE LOWER('%${filters.user_id}%') AND LOWER(bot_users.name) LIKE LOWER('%${filters.name}%') AND LOWER(bot_users.email) LIKE LOWER('%${filters.email}%') ${filters.product_id !== 'all'? `AND products.id = ${filters.product_id}` : ''} ${filters.status !== 'all'? `AND users_plans.status = ${filters.status} ${!filters.status? 'OR users_plans.status IS NULL' : ''}` : ''} ${filters.is_active !== 'all'? `AND bot_users.is_active = ${filters.is_active}` : ''} AND LOWER(bot_users.created_at) LIKE LOWER('%${filters.created_at? (filters.created_at.replace(/\//g, '-')).split("-").reverse().join("-") : ''}%')` : '' }`)
        )[0];

        for (let i = users.length - 1; i >= 0; i--) {
          const user = users[i];
    
          if (filters && filters.telegram) {
            if (user.telegram) {
              const telegram_user = '(await bot.getChat(user.telegram)).username';
              user.telegram = telegram_user;
              if (!telegram_user.includes(filters.telegram)) {
                users.splice(i, 1);
                continue;
              }
            } else {
              users.splice(i, 1);
              continue;
            }
          } else {
            if (user.telegram) {
              user.telegram = '(await bot.getChat(user.telegram)).username';
            } else {
              user.telegram = 'off';
            }
          }

          if (filters && filters.balance) {         
            const balance = `${await TransactionsService.balance(null, true, user)}`;
            if (balance.includes(filters.balance)) {
              user.balance = balance;
            } else {
              users.splice(i, 1);
            }
          } else {
            const balance = await TransactionsService.balance(null, true, user);
            user.balance = balance;
          }
        }
        return users;
        
    } catch (error) {
      throw error;
    }
  }

  static async botUser(id:string): Promise<any> {
    try {
        const user:any = (
            await conn.query(`SELECT bot_users.id, bot_users.name, bot_users.email, bot_users.cpf, bot_users.phone_number, bot_users.adress, bot_users.pix_code, bot_users.is_active, COALESCE(products.name, 'without') as plan, bot_users.telegram_user_id as telegram, DATE_FORMAT(bot_users.created_at, '%d/%m/%Y') AS created_at, users_plans.status FROM bot_users LEFT JOIN users_plans ON bot_users.id = users_plans.user_id LEFT JOIN products ON products.id = users_plans.product_id WHERE bot_users.id = ${id}`)
        )[0][0];

        if (user.telegram) {
          user.telegram = '(await bot.getChat(user.telegram)).username';
        } else {
          user.telegram = 'off';
        }

        return user;
        
    } catch (error) {
      throw error;
    }
  }

  static async updateBotUser(body:any): Promise<any> {
    try {

      let user = (
        await conn.query(`SELECT * FROM bot_users WHERE id = '${body.id}'`)
      )[0][0];

      if(!user) throw Error("Usuário Inexistente");

      await conn.execute(`UPDATE bot_users SET name='${body.name}',email='${body.email}',cpf='${body.cpf}', ${body.password? `password='${SHA1(body.password).toString()}, ` : ''} phone_number='${body.phone_number}', adress='${body.adress}', pix_code='${body.pix_code}' WHERE id = '${body.id}'`)

        return { status: true, message: "Usuário atualizado com sucesso" }
        
    } catch (error) {
      throw error;
    }
  }

  static async isActiveBotUser(userId:number, status:number): Promise<any> {
    try {

      let user = (
        await conn.query(`SELECT * FROM bot_users WHERE id = '${userId}'`)
      )[0][0];

      if(!user) throw Error("Usuário Inexistente");
      
      await conn.execute(`UPDATE bot_users SET is_active='${status}', telegram_user_id=null WHERE id = '${userId}'`)

      return { status: true, message: "Usuário atualizado com sucesso" }
        
    } catch (error) {
      throw error;
    }
  }

  static async transfValuesAdmin(data:any): Promise<any> {
    try {
      
      await conn.execute(`INSERT INTO balance(value, user_id, type, origin) VALUES ('${data.value}','${data.user_id}','${data.type}','admin')`);

      return { status: true, message: "Usuário atualizado com sucesso" }
        
    } catch (error) {
      throw error;
    }
  }

}
