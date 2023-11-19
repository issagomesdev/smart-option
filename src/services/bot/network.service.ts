import conn from "../../db";

export class NetworkService {

  static async affiliateNetwork(telegramUserId: number, level:string){
    try {
        const user = (
        await conn.query(`SELECT name FROM bot_users INNER JOIN network ON bot_users.id = network.guest_user_id WHERE network.affiliate_user_id = ${telegramUserId} AND network.level = ${level}`)
        )[0];

        return user
    } catch (error) {
        throw error;
    }
  }

  static async guestNetwork(telegramUserId: number){
    try {
        const user = (
        await conn.query(`SELECT * FROM network WHERE guest_user_id = '${telegramUserId}'`)
        )[0][0];
        return user
    } catch (error) {
        throw error;
    }
  }

  static async upNetwork(affiliateId: number, guestId: number){
    try {

            await conn.query(`INSERT INTO network(affiliate_user_id, guest_user_id, level) VALUES ('${affiliateId}','${guestId}','1')`);

            const isL1Guest = (
                await conn.query(`SELECT * FROM network WHERE guest_user_id = ${affiliateId} AND level = '1'`)
            )[0][0];

            if(isL1Guest){
                    await conn.query(`INSERT INTO network(affiliate_user_id, guest_user_id, level) VALUES ('${isL1Guest.affiliate_user_id}','${guestId}','2')`);

                    const isL2Guest = (
                        await conn.query(`SELECT * FROM network WHERE guest_user_id = ${isL1Guest.affiliate_user_id} AND level = '1'`)
                    )[0][0];

                    if(isL2Guest){
                        await conn.query(`INSERT INTO network(affiliate_user_id, guest_user_id, level) VALUES ('${isL2Guest.affiliate_user_id}','${guestId}','3')`);
                    }
                }

    } catch (error) {
        throw error;
    }
  }
}