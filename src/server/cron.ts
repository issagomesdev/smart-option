import cron from "node-cron";
import conn from "./../db";
import moment from 'moment';
import { TransactionsService } from "../services/bot/transactions.service";
import { NetworkService } from "../services/bot/network.service";

export const cronStart = cron.schedule(
	"0 0 * * 1-5",
	async () => {
	 checkExpiredUsers();
	},
	{
		timezone: "America/Sao_Paulo",
	}
);

async function checkExpiredUsers() {
	const expired:any = (
		await conn.query(`SELECT user_id, product_id FROM users_plans WHERE expired_in < NOW() AND status = 1`)
	  )[0];

	  await expired.map(async(user) => {
		const balance = await TransactionsService.balance(user.user_id);
		const product:any = (
			await conn.query(`SELECT price FROM products WHERE id = ${user.product_id}`)
		  )[0][0];

		  if(product.price <= balance){
			
            await conn.execute(`INSERT INTO balance(value, user_id, type, origin, transaction_id) VALUES ('${product.price}','${user.user_id}', 'subtract', 'product', 'auto_renovation')`);

            const today: moment.Moment = moment();
            const monthLater: moment.Moment = today.add(1, 'months');
			
			await conn.query(`UPDATE users_plans SET product_id='${user.product_id}', checkout_id='auto', status='1', acquired_in='${today.format('YYYY-MM-DD HH:mm:ss')}', expired_in='${monthLater.format('YYYY-MM-DD HH:mm:ss')}' WHERE user_id = '${user.user_id}'`);
			
		  } else {

			await conn.query(`UPDATE users_plans SET status='0', checkout_id=null WHERE user_id = '${user.user_id}'`);

		  }
	  });

	  await applyEarnings();
}

async function applyEarnings() {

	const users:any = (
		await conn.query(`SELECT user_id, product_id FROM users_plans WHERE status = 1`)
	  )[0];

	  await users.map(async(user) => {
		const balance:any = await TransactionsService.balance(user.user_id);
		const product:any = (
			await conn.query(`SELECT monthly_earnings FROM products WHERE id = ${user.product_id}`)
		  )[0][0];

		const daily_earnings:any = (product.monthly_earnings / 22).toFixed(2);
		const today_earnings:any = ((daily_earnings / 100) * balance).toFixed(2);

		await conn.execute(`INSERT INTO balance(value, user_id, type, origin, transaction_id) VALUES ('${today_earnings}','${user.user_id}', 'sum', 'earning', 'auto')`);

		NetworkService.earnings(user.user_id, today_earnings, "profitability")

	  });

}


