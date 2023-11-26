
import { TransactionsService } from "../../services/bot/transactions.service";
import express from "express";

export default express
  .Router()
  .post('/checkout-successful/:reference_id', async(req, res) => {

    TransactionsService.checkoutSuccessful(req.params.reference_id)

    });