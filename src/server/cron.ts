import cron from "node-cron";
import conn from "./../db";
import moment from 'moment';
import { TransactionsService } from "../services/bot/transactions.service";
import { NetworkService } from "../services/bot/network.service";

export const dailyCron = cron.schedule(
	"0 0 * * 1-5",
	async () => {
	  try {
		await checkExpiredUsers();
		await applyEarningsDaily();
	  } catch (error) {
		console.log("Erro:", error);
	  }
	},
	{
	  timezone: "America/Sao_Paulo",
	}
  );

export const everyMinuteCron = cron.schedule(
	"1-59 0,10 * * *",
	async () => {
		try {
			await checkUsersWithoutPlan();
		  } catch (error) {
			console.log("Erro:", error);
		  }
	},
	{
		timezone: "America/Sao_Paulo",
	}
);

async function checkExpiredUsers() {
	const expired:any = (
		await conn.query(`SELECT user_id, product_id FROM users_plans WHERE expired_in < NOW() AND status = '1'`)
	  )[0];

	  await expired.map(async(user) => {
		const balance = await TransactionsService.balance(user.user_id);
		const product:any = (
			await conn.query(`SELECT price FROM products WHERE id = '${user.product_id}'`)
		  )[0][0];

		  if(product.price <= balance){	
            await TransactionsService.renewTuition(user, product)
		  } else {
			await conn.query(`UPDATE users_plans SET status='0' WHERE user_id = '${user.user_id}'`);
		  }
	  });

	  
}

async function applyEarningsDaily() {

	const users:any = (
		await conn.query(`SELECT user_id, product_id FROM users_plans WHERE status = '1'`)
	  )[0];

	  await users.map(async(user) => {
		const balance:any = await TransactionsService.balance(null, false, user.user_id);
		
		const product:any = (
			await conn.query(`SELECT earnings_monthly FROM products WHERE products.id = '${user.product_id}'`)
		  )[0][0];

		const daily_earnings:any = Math.floor((product.monthly_earnings / 22) * 100) / 100;
		const today_earnings:any = Math.floor(((daily_earnings / 100) * balance) * 100) / 100;

		await conn.execute(`INSERT INTO balance(value, user_id, type, origin) VALUES ('${today_earnings}','${user.user_id}', 'sum', 'earnings')`);

		NetworkService.networkRepass(user.user_id, today_earnings, "earnings", true)

	  });

}

async function checkUsersWithoutPlan() {
	const expired:any = (
		await conn.query(`SELECT user_id, product_id FROM users_plans WHERE status = '0'`)
	  )[0];

	  await expired.map(async(user) => {
		const balance = await TransactionsService.balance(null, true, user);
		const product:any = (
			await conn.query(`SELECT price FROM products WHERE id = '${user.product_id}'`)
		  )[0][0];

		  if(product.price <= balance){	
            await TransactionsService.renewTuition(user, product)
		  } else {
			await conn.query(`UPDATE users_plans SET status='0' WHERE user_id = '${user.user_id}'`);
		  }
	  });

	  
}


