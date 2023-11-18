import conn from "../../db";
import { SHA1 } from "crypto-js";

export class RegisterService {

  static async registerUser(body:any, userId:number): Promise<any> {
    try {

      const user = (
        await conn.query(`SELECT * FROM bot_users WHERE email = '${body.email}'`)
      )[0][0];

      if(user) throw Error("Email já em uso");

      await conn.execute(
        `INSERT INTO bot_users(name, email, password, phone_number, adress, bank_name, bank_agency_number, bank_account_number, pix_code, created_at, last_activity) VALUES ('${body.name}','${body.email}','${SHA1(body.password).toString()}','${body.phone_number}','${body.adress}','${body.bank_name}','${body.bank_agency_number}','${body.bank_account_number}','${body.pix_code}', '${new Date().getFullYear()}-${(new Date().getMonth() + 1).toString().padStart(2, '0')}-${new Date().getDate().toString().padStart(2, '0')} ${new Date().getHours().toString().padStart(2, '0')}:${new Date().getMinutes().toString().padStart(2, '0')}:${new Date().getSeconds().toString().padStart(2, '0')}','${new Date().getFullYear()}-${(new Date().getMonth() + 1).toString().padStart(2, '0')}-${new Date().getDate().toString().padStart(2, '0')} ${new Date().getHours().toString().padStart(2, '0')}:${new Date().getMinutes().toString().padStart(2, '0')}:${new Date().getSeconds().toString().padStart(2, '0')}')`
      ); 
    } catch (error) {
      throw error;
    }
  }

}
