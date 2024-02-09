
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
    .post('/transfers/:reference_id', async(req, res) => {
      try {
        console.log('hook', req.params.reference_id, req.body)
      } catch (error) {
        console.log(error);
      }
  
      });