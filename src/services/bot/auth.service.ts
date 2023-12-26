import conn from "../../db";
import { SHA1 } from "crypto-js";
import moment from 'moment';

export class AuthenticationService {

  static async login(email: string, password: string, userId:number): Promise<any> {
    try {
        const user = (
            await conn.query(`SELECT * FROM bot_users WHERE email = '${email}'`)
        )[0][0];
        if(!user || user.password != SHA1(password)) throw Error("Email e/ou senha inválidos");
        if(!user.verified_email_at) throw Error("Email não validado");
        if(!user.is_active) throw Error("Acesso bloqueado, contate o suporte");

        await conn.query(`UPDATE bot_users SET telegram_user_id='${userId}', last_activity='${moment().format('YYYY-MM-DD HH:mm:ss')}' WHERE id = '${user.id}'`);

        return user;
    } catch (error) {
      throw error;
    }
  }

  static async isLoggedIn(userId:number): Promise<any> {
    try {
        const user = (
            await conn.query(`SELECT * FROM bot_users WHERE telegram_user_id = ${userId}`)
        )[0][0];

        if(user) await conn.query(`UPDATE bot_users SET last_activity='${moment().format('YYYY-MM-DD HH:mm:ss')}' WHERE id = '${user.id}'`);

        return user
    } catch (error) {
      throw error;
    }
  }

  static async logout(userId: number){
    try {
      await conn.query(`UPDATE bot_users SET telegram_user_id=NULL WHERE telegram_user_id = '${userId}'`)
    } catch (error) {
      throw error;
    }
  }

}

