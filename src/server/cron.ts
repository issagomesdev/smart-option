import cron from "node-cron";
import conn from "./../db";
import moment from 'moment';
import { TransactionsService } from "../services/bot/transactions.service";
import { NetworkService } from "../services/bot/network.service";
import { walletService } from "../wallet/wallet.service";
import { logger } from "../shared/logger";

export const lastDayinMonthCron = cron.schedule(
	"0 0 28-31 * *",
	async () => {
	  try {
		await applyDiamondTax();
	  } catch (error) {
		logger.error({ err: error }, "Erro no cron mensal (taxa diamante)");
	  }
	},
	{
	  timezone: "America/Sao_Paulo",
	}
);

export const dailyCron = cron.schedule(
	"0 0 * * 1-5",
	async () => {
	  try {
		await checkExpiredUsers();
		await applyEarningsDaily();
		await checkDiamondUsers();
	  } catch (error) {
		logger.error({ err: error }, "Erro no cron diário");
	  }
	},
	{
	  timezone: "America/Sao_Paulo",
	}
);

export const everyMinuteCron = cron.schedule(
	"* * * * *",
	async () => {
		try {
			await checkUsersWithoutPlan();
		  } catch (error) {
			logger.error({ err: error }, "Erro no cron de verificação de planos");
		  }
	},
	{
		timezone: "America/Sao_Paulo",
	}
);

async function applyDiamondTax() {
	const users:any = (
		await conn.query(`SELECT user_id FROM users_plans WHERE status = '1' AND product_id = '4'`)
	  )[0];

	  const today = moment().format('YYYY-MM');

	  for (const user of users) {
		const balance = await TransactionsService.balance(null, true, user);
		const tax = 0.04 * balance;

		if (tax > 0) {
			await walletService.debit({
				userId: user.user_id,
				amount: tax,
				origin: "diamond_tax",
				idempotencyKey: `diamond_tax:${user.user_id}:${today}`,
			});
		}
	  }
}

async function checkExpiredUsers() {
	const expired:any = (
		await conn.query(`SELECT user_id, product_id FROM users_plans WHERE expired_in < NOW() AND status = '1'`)
	  )[0];

	  for (const user of expired) {
		const balance = await TransactionsService.balance(null, true, user);
		const product:any = (
			await conn.query(`SELECT id, price FROM products WHERE id = '${user.product_id}'`)
		  )[0][0];

		  if(product.price <= balance){
			await TransactionsService.renewTuition(user, product)
		  } else {
			await conn.query(`UPDATE users_plans SET status='0' WHERE user_id = '${user.user_id}'`);
		  }
	  }
}

async function applyEarningsDaily() {

	const users:any = (
		await conn.query(`SELECT user_id, product_id FROM users_plans WHERE status = '1'`)
	  )[0];

	  const today = moment().format('YYYY-MM-DD');

	  for (const user of users) {
		const balance = await TransactionsService.balance(null, false, user);

		const product:any = (
			await conn.query(`SELECT earnings_monthly FROM products WHERE products.id = '${user.product_id}'`)
		  )[0][0];

		const daily_earnings:number = (Math.floor((product.earnings_monthly / 22) * 100) / 100);
		const today_earnings:number = (daily_earnings / 100) * balance;

		if(today_earnings > 0){
			const idempotencyKey = `earnings:${user.user_id}:${today}`;

			await walletService.credit({
				userId: user.user_id,
				amount: today_earnings,
				origin: "earnings",
				idempotencyKey,
			});

			await NetworkService.networkRepass(user.user_id, today_earnings, "earnings", idempotencyKey, true);
		}

	  }

}

async function checkDiamondUsers() {
	const users:any = (
		await conn.query(`SELECT user_id FROM users_plans WHERE status = '1'`)
	  )[0];

	  for (const user of users) {
		const hasPlan = (
			await conn.query(`SELECT product_id FROM users_plans WHERE user_id = '${user.user_id}' AND status = 1`)
		  )[0][0];

		  const balance = await TransactionsService.balance(null, true, user);

		  if(hasPlan && hasPlan.product_id != 4 && balance >= 20000) await conn.query(`UPDATE users_plans SET product_id='4', status='1', acquired_in='${moment().format('YYYY-MM-DD HH:mm:ss')}', expired_in='${moment().add(1, 'months').format('YYYY-MM-DD HH:mm:ss')}' WHERE user_id = '${user.user_id}'`);

		  if(hasPlan && hasPlan.product_id == 4 && balance < 20000) await conn.query(`UPDATE users_plans SET product_id='3', status='1', acquired_in='${moment().format('YYYY-MM-DD HH:mm:ss')}', expired_in='${moment().add(1, 'months').format('YYYY-MM-DD HH:mm:ss')}' WHERE user_id = '${user.user_id}'`);
	  }

}

async function checkUsersWithoutPlan() {
	const expired:any = (
		await conn.query(`SELECT user_id, product_id FROM users_plans WHERE status = '0'`)
	  )[0];

	  for (const user of expired) {
		const balance = await TransactionsService.balance(null, true, user);
		const product:any = (
			await conn.query(`SELECT id, price FROM products WHERE id = '${user.product_id}'`)
		  )[0][0];

		  if(product.price <= balance){
			await TransactionsService.renewTuition(user, product)
		  }
	  }
}
