
import { TransactionsService } from "../../services/bot/transactions.service";
import express from "express";

export default express
  .Router()
  .post('/checkouts/:reference_id', async(req, res) => {

    try {
      if(req.body.charges){
        TransactionsService.finishCheckout(req.params.reference_id, req.body.charges[0].status)
      }
    } catch (error) {
      console.log(error);
    }

    })
  .get('/challenge', async(req, res) => {
    res.status(200).json({
      "public_key": `${process.env.PUBLIC_KEY}`,
      "created_at": 1704593661363
    });
  });