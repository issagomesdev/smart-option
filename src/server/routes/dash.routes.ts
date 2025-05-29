

import { DashboardService } from "../../services/dash.service";
import express from "express";
import { NextFunction, Request, Response } from "express";
import { HttpException } from "../../exceptions/http.exception";

export default express
  .Router()
    .get('/users', async(req: Request, res: Response, next: NextFunction) => { // Listagem de usuários do bot
        try {
            const response = await DashboardService.users();
            res.status(200).json(response);
        } catch (error) {
            console.log(error);
            next(new HttpException(400, error));
        }
    })
    .get('/balance/:user_id/:product_id/:period', async(req: Request, res: Response, next: NextFunction) => { // obter o saldo de um usuário podendo filtrar por plano/produto atual e período
        try {
            const response = await DashboardService.balance(req.params.user_id, req.params.product_id, req.params.period);
            res.status(200).json(response);
        } catch (error) {
            console.log(error);
            next(new HttpException(400, error));
        }
    })
    .get('/plans', async(req: Request, res: Response, next: NextFunction) => { // Listagem de planos/produtos
        try {
            const response = await DashboardService.getPlans();
            res.status(200).json(response);
        } catch (error) {
            console.log(error);
            next(new HttpException(400, error));
        }
    });
    
