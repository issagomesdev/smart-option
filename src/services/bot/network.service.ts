import conn from "../../db";

export class NetworkService {

  static async affiliateNetwork(userId: number){
    try {

        const user = (
            await conn.query(`SELECT * FROM bot_users WHERE telegram_user_id = ${userId}`)
          )[0][0];
          
        const network = (
        await conn.query(`SELECT bot_users.name, network.level, CASE WHEN users_plans.status = 1 THEN 1 ELSE 0 END AS status FROM bot_users INNER JOIN network ON bot_users.id = network.guest_user_id LEFT JOIN users_plans ON bot_users.id = users_plans.user_id WHERE network.affiliate_user_id = ${user.id} ORDER BY level;`)
        )[0];

        return network
    } catch (error) {
        throw error;
    }
  }

  static async networkRepass(userId: number, value:number, type:string){
    try {
        const L1 = (
            await conn.query(`SELECT * FROM network WHERE guest_user_id = ${userId} AND level = '1' ${type == 'earnings'? 'AND earnings = 1' : ''}`)
        )[0][0];

        if(L1) {
            
            const L1HasPlan = (
                await conn.query(`SELECT * FROM users_plans WHERE user_id = ${L1.affiliate_user_id} AND status = 1`)
            )[0][0];

            if(L1HasPlan) {
                NetworkService.earningsPercentage(L1HasPlan.product_id, type, 1)
                .then(async(prctg) => await conn.execute(`INSERT INTO balance(value, user_id, type, origin) VALUES ('${(prctg / 100) * value}','${L1.affiliate_user_id}', 'sum', '${type}')`))
             } 

            const L2 = (
                await conn.query(`SELECT * FROM network WHERE guest_user_id = ${userId} AND level = '2' ${type == 'earnings'? 'AND earnings = 1' : ''}`)
            )[0][0];

            if(L2){
                const L2HasPlan = (
                    await conn.query(`SELECT * FROM users_plans WHERE user_id = ${L2.affiliate_user_id} AND status = 1`)
                )[0][0];
    
                if(L2HasPlan) {
                    NetworkService.earningsPercentage(L2HasPlan.product_id, type, 2)
                    .then(async(prctg) => await conn.execute(`INSERT INTO balance(value, user_id, type, origin) VALUES ('${(prctg / 100) * value}','${L2.affiliate_user_id}', 'sum', '${type}')`))
                }

                const L3 = (
                    await conn.query(`SELECT * FROM network WHERE guest_user_id = ${userId} AND level = '3' ${type == 'earnings'? 'AND earnings = 1' : ''}`)
                )[0][0];

                if(L3){

                    const L3HasPlan = (
                        await conn.query(`SELECT * FROM users_plans WHERE user_id = ${L3.affiliate_user_id} AND status = 1`)
                    )[0][0];
        
                    if(L3HasPlan) {
                        NetworkService.earningsPercentage(L3HasPlan.product_id, type, 3)
                        .then(async(prctg) => await conn.execute(`INSERT INTO balance(value, user_id, type, origin) VALUES ('${(prctg / 100) * value}','${L3.affiliate_user_id}', 'sum', '${type}')`))
                    }
                }
                
            }
        }
        
    } catch (error) {
        throw error;
    }
  }

  static async earningsPercentage(id: number, type:string, level:number){
    try {

        const earning = (
            await conn.query(`SELECT percentage FROM product_earnings WHERE product_id = ${id} AND level = '${level}' AND type = '${type}'`)
        )[0][0].percentage;

        return earning;
        
    } catch (error) {
        throw error;
    }
  }

  static async upNetwork(affiliateId: number, guestId: number){
    try {

        const earningsUsersL1 = (
            await conn.query(`SELECT COUNT(*) AS amount FROM network WHERE affiliate_user_id = ${affiliateId} AND level = '1' AND earnings = 1`)
       )[0][0];

            await conn.query(`INSERT INTO network(affiliate_user_id, guest_user_id, level, earnings) VALUES ('${affiliateId}','${guestId}','1', ${earningsUsersL1.amount < 3? 1 : 0 })`);

            const affiliateIsGuest = (
                await conn.query(`SELECT * FROM network WHERE guest_user_id = ${affiliateId} AND level = '1'`)
            )[0][0];

            if(affiliateIsGuest){

                const earningsUsersL2 = (
                    await conn.query(`SELECT COUNT(*) AS amount FROM network WHERE affiliate_user_id = ${affiliateIsGuest.affiliate_user_id} AND level = '2' AND earnings = 1`)
               )[0][0];

                    await conn.query(`INSERT INTO network(affiliate_user_id, guest_user_id, level, earnings) VALUES ('${affiliateIsGuest.affiliate_user_id}','${guestId}','2', ${earningsUsersL2.amount < 3? 1 : 0 })`);

                    const affiliate2IsGuest = (
                        await conn.query(`SELECT * FROM network WHERE guest_user_id = ${affiliateIsGuest.affiliate_user_id} AND level = '1'`)
                    )[0][0];
                    

                    if(affiliate2IsGuest){

                        const earningsUsersL3 = (
                            await conn.query(`SELECT COUNT(*) AS amount FROM network WHERE affiliate_user_id = ${affiliate2IsGuest.affiliate_user_id} AND level = '3' AND earnings = 1`)
                       )[0][0];

                        await conn.query(`INSERT INTO network(affiliate_user_id, guest_user_id, level, earnings) VALUES ('${affiliate2IsGuest.affiliate_user_id}','${guestId}','3', ${earningsUsersL3.amount < 3? 1 : 0 })`);
                    }
                }

    } catch (error) {
        throw error;
    }
  }
}

