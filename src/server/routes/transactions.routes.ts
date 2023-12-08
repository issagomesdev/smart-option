
import { TransactionsService } from "../../services/bot/transactions.service";
import express from "express";

export default express
  .Router()
  .post('/checkout-successful/:reference_id', async(req, res) => {

    try {
      if(req.body.charges){
        TransactionsService.finishCheckout(req.params.reference_id, req.body.charges[0].status)
      }
    } catch (error) {
      console.log(error);
    }

    });