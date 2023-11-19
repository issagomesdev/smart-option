import conn from "../../db";
import { SHA1 } from "crypto-js";

export class AuthenticationService {

  static async login(email: string, password: string, userId:number): Promise<any> {
    try {
        const user = (
            await conn.query(`SELECT * FROM bot_users WHERE email = '${email}'`)
        )[0][0];
        if(!user || user.password != SHA1(password)) throw Error("Email e/ou senha inválidos");
        if(!user.verified_email_at) throw Error("Parece que seu e-mail ainda não foi validado. Por favor, verifique a caixa de entrada do email associado à sua conta no cadastro, abra o email enviado e clique no link fornecido para ativar sua conta. Caso não encontre, verifique a pasta de spam ou entre em contato conosco para assistência.");

        await conn.query(`UPDATE bot_users SET telegram_user_id='${userId}', last_activity='${new Date().getFullYear()}-${(new Date().getMonth() + 1).toString().padStart(2, '0')}-${new Date().getDate().toString().padStart(2, '0')} ${new Date().getHours().toString().padStart(2, '0')}:${new Date().getMinutes().toString().padStart(2, '0')}:${new Date().getSeconds().toString().padStart(2, '0')}' WHERE id = '${user.id}'`);

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

        if(user) await conn.query(`UPDATE bot_users SET last_activity='${new Date().getFullYear()}-${(new Date().getMonth() + 1).toString().padStart(2, '0')}-${new Date().getDate().toString().padStart(2, '0')} ${new Date().getHours().toString().padStart(2, '0')}:${new Date().getMinutes().toString().padStart(2, '0')}:${new Date().getSeconds().toString().padStart(2, '0')}' WHERE id = '${user.id}'`);

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

