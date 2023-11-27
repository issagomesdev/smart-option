import conn from "../../db";

export class RequestsService {

  static async request(type:string, userId: number, subject:string): Promise<any> {
    try {

      let user = (
        await conn.query(`SELECT * FROM bot_users WHERE telegram_user_id = '${userId}'`)
      )[0][0];

        await conn.execute(`INSERT INTO requests(type, user_id, telegram_user_id, subject) VALUES ('${type}','${user.id}', '${userId}', '${subject}')`);
    } catch (error) {
      throw error;
    }
  }

}

