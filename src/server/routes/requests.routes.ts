
import { RequestService } from "../../services/requests.service";
import express from "express";
import { NextFunction, Request, Response } from "express";
import { HttpException } from "../../exceptions/http.exception";

export default express
  .Router()
    .get('/extract/:id', async(req: Request, res: Response, next: NextFunction) => { // obter extrato de um usuário
      try {
          const response = await RequestService.extract(Number(req.params.id) || null);
          res.status(200).json(response);
      } catch (error) {
          console.log(error);
          next(new HttpException(400, error));
      }
    })
    .post('/extract/:id', async(req: Request, res: Response, next: NextFunction) => { // obter extrato de um usuário com filtros
      try {
          const response = await RequestService.extract(Number(req.params.id) || null, req.body);
          res.status(200).json(response);
      } catch (error) {
          console.log(error);
          next(new HttpException(400, error));
      }
    })
    .post('/withdrawal/:id', async(req: Request, res: Response, next: NextFunction) => { // obter requisições de saque de um usuário
      try {
          const response = await RequestService.withdrawalRequests(Number(req.params.id) || null, req.body);
          res.status(200).json(response);
      } catch (error) {
          console.log(error);
          next(new HttpException(400, error));
      }
    })
    .post('/deposit/:id', async(req: Request, res: Response, next: NextFunction) => { // obter requisições de depósito de um usuário
      try {
          const response = await RequestService.depositsRequests(Number(req.params.id) || null, req.body);
          res.status(200).json(response);
      } catch (error) {
          console.log(error);
          next(new HttpException(400, error));
      }
    })
    .post('/support/:id', async(req: Request, res: Response, next: NextFunction) => { // obter requisições de suporte de um usuário
      try {
          const response = await RequestService.supportRequests(Number(req.params.id) || null, req.body);
          res.status(200).json(response);
      } catch (error) {
          console.log(error);
          next(new HttpException(400, error));
      }
    })
    .post('/subscription/:id', async(req: Request, res: Response, next: NextFunction) => { // obter requisições de adesão a um produto de um usuário
      try {
          const response = await RequestService.subscriptionsRequests(Number(req.params.id) || null, req.body);
          res.status(200).json(response);
      } catch (error) {
          console.log(error);
          next(new HttpException(400, error));
      }
    })
    .post('/res-withdrawal', async(req: Request, res: Response, next: NextFunction) => {  // aprovar e rejeitar requisições de saque
      try {
          const response = await RequestService.resWithdrawal(req.body.res);
          res.status(200).json(response);
      } catch (error) {
          console.log(error);
          next(new HttpException(400, error));
      }
    })
    .patch('/was-read/:id/:status', async(req: Request, res: Response, next: NextFunction) => { // marcar solicitações de suporte  como lidas
      try {
          const response = await RequestService.wasRead(req.params.id, req.params.status);
          res.status(200).json(response);
      } catch (error) {
          console.log(error);
          next(new HttpException(400, error));
      }
    })
    .get('/pendencies', async(req: Request, res: Response, next: NextFunction) => { // obter requisições pendentes de resposta
      try {
          const response = await RequestService.pendingRequests();
          res.status(200).json(response);
      } catch (error) {
          console.log(error);
          next(new HttpException(400, error));
      }
    })
    
