import conn from "../../db";
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import moment from 'moment';
import { NetworkService } from "./network.service";


export class TransactionsService {

  static async checkout(userId: number, value:number, product:any = null){
    try {

      const user = (
        await conn.query(`SELECT * FROM bot_users WHERE telegram_user_id = '${userId}'`)
      )[0][0];

      const checkout:any = (
        await conn.execute(`INSERT INTO checkouts(reference_id, type, value, user_id, product_id) VALUES ('${uuidv4()}','${product? 'product' : 'deposit'}', '${value}', '${user.id}', ${product? product.id : null})`)
        )[0];

      const ref_checkout = (
        await conn.query(`SELECT reference_id FROM checkouts WHERE id = '${checkout.insertId}'`)
      )[0][0];


      let item:any;
      
      product? item = { reference_id: `${product.id}`, name: `SMART OPTION E.A. Plano ${product.name}`, quantity: 1, unit_amount: value*100}  : item = { name: `SMART OPTION E.A. Depósito`, quantity: 1, unit_amount: value*100}

      const options = {
        method: 'POST',
        headers: {
          accept: 'application/json',
          'Content-type': 'application/json',
          Authorization: `Bearer ${process.env.PAG_TOKEN}`
        },
        body: JSON.stringify({
          items: [item],
          reference_id: checkout.insertId.toString(),
          redirect_url: `https://www.smartoptionea.com/transactions/checkout-successful/${ref_checkout.reference_id}`
        })
      };

      const response = await fetch(`${process.env.PAG_CHK_PATH}/checkouts`, options);
      const data = await response.json();

      await conn.query(`UPDATE checkouts SET transaction_id='${data.id}' WHERE id = '${checkout.insertId}'`);
      return data.links.find(link => link.rel == "PAY").href;

    } catch (error) {
      throw error;
    }
  }

  static async checkoutSuccessful(reference_id:string){
    try {

      const ref_checkout = (
        await conn.query(`SELECT * FROM checkouts WHERE reference_id = '${reference_id}'`)
      )[0][0];

      if(ref_checkout){
        await conn.query(`UPDATE checkouts SET status='paid' WHERE id = '${ref_checkout.id}'`);
        if(ref_checkout.type == "deposit"){
          await conn.execute(`INSERT INTO balance(value, user_id, type, origin) VALUES ('${ref_checkout.value}','${ref_checkout.user_id}', 'sum', '${ref_checkout.type}')`)
        }

        if(ref_checkout.type == "product"){

          const today: moment.Moment = moment();
          const monthLater: moment.Moment = today.add(1, 'months');
          const expired_in: string = monthLater.format('YYYY-MM-DD HH:mm:ss')
          await conn.query(`UPDATE users_plans SET status='0' WHERE user_id = '${ref_checkout.user_id}'`);
          await conn.execute(`INSERT INTO users_plans(user_id, product_id, checkout_id, expired_in) VALUES ('${ref_checkout.user_id}','${ref_checkout.product_id}', '${ref_checkout.id}', '${expired_in}')`)
        }

        NetworkService.accession(ref_checkout.user_id, ref_checkout.value)
      }

    } catch (error) {
      throw error;
    }
  }

}