
import { TransactionsService } from "../../services/bot/transactions.service";
import { NextFunction, Request, Response } from "express";
import { HttpException } from "../../exceptions/http.exception";
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
  .post('/checkouts-test', async(req: Request, res: Response, next: NextFunction) => {
      const { userId, value } = req.body;
      try {
        const response =  await TransactionsService.checkout(userId, value);
        res.status(200).json(response);
      } catch (error) {
          console.log(error);
          next(new HttpException(400, error));
      }
    })
  .get('/challenge', async(req, res) => {
    res.status(200).json({
      "public_key": `${process.env.PUBLIC_KEY}`,
      "created_at": 1704593661363
    });
  });