
import { FinancialService } from "../../services/financial.service";
import express from "express";
import { NextFunction, Request, Response } from "express";
import { HttpException } from "../../exceptions/http.exception";

export default express
  .Router()
    .get('/extract/:id', async(req: Request, res: Response, next: NextFunction) => {
      try {
          const response = await FinancialService.extract(Number(req.params.id));
          res.status(200).json(response);
      } catch (error) {
          console.log(error);
          next(new HttpException(400, error));
      }
    })
    .get('/withdrawal/:id', async(req: Request, res: Response, next: NextFunction) => {
      try {
          const response = await FinancialService.withdrawalRequests(Number(req.params.id));
          res.status(200).json(response);
      } catch (error) {
          console.log(error);
          next(new HttpException(400, error));
      }
    })
    
