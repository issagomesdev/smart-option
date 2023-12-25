
import { RequestService } from "../../services/requests.service";
import express from "express";
import { NextFunction, Request, Response } from "express";
import { HttpException } from "../../exceptions/http.exception";

export default express
  .Router()
    .get('/extract/:id', async(req: Request, res: Response, next: NextFunction) => {
      try {
          const response = await RequestService.extract(Number(req.params.id) || null);
          res.status(200).json(response);
      } catch (error) {
          console.log(error);
          next(new HttpException(400, error));
      }
    })
    .post('/extract/:id', async(req: Request, res: Response, next: NextFunction) => {
      try {
          const response = await RequestService.extract(Number(req.params.id) || null, req.body);
          res.status(200).json(response);
      } catch (error) {
          console.log(error);
          next(new HttpException(400, error));
      }
    })
    .post('/withdrawal/:id', async(req: Request, res: Response, next: NextFunction) => {
      try {
          const response = await RequestService.withdrawalRequests(Number(req.params.id) || null, req.body);
          res.status(200).json(response);
      } catch (error) {
          console.log(error);
          next(new HttpException(400, error));
      }
    })
    .post('/deposit/:id', async(req: Request, res: Response, next: NextFunction) => {
      try {
          const response = await RequestService.depositsRequests(Number(req.params.id) || null, req.body);
          res.status(200).json(response);
      } catch (error) {
          console.log(error);
          next(new HttpException(400, error));
      }
    })
    .post('/support/:id', async(req: Request, res: Response, next: NextFunction) => {
      try {
          const response = await RequestService.supportRequests(Number(req.params.id) || null, req.body);
          res.status(200).json(response);
      } catch (error) {
          console.log(error);
          next(new HttpException(400, error));
      }
    })
    .post('/subscription/:id', async(req: Request, res: Response, next: NextFunction) => {
      try {
          const response = await RequestService.subscriptionsRequests(Number(req.params.id) || null, req.body);
          res.status(200).json(response);
      } catch (error) {
          console.log(error);
          next(new HttpException(400, error));
      }
    })
    .post('/res-withdrawal', async(req: Request, res: Response, next: NextFunction) => {
      try {
          const response = await RequestService.resWithdrawal(req.body.res);
          res.status(200).json(response);
      } catch (error) {
          console.log(error);
          next(new HttpException(400, error));
      }
    })
    
