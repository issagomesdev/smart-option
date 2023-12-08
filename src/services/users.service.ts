import conn from "../db";

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

}
