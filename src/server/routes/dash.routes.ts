

import { DashboardService } from "../../services/dash.service";
import express from "express";
import { NextFunction, Request, Response } from "express";
import { HttpException } from "../../exceptions/http.exception";

export default express
  .Router()
    .get('/users', async(req: Request, res: Response, next: NextFunction) => {
        try {
            const response = await DashboardService.users();
            res.status(200).json(response);
        } catch (error) {
            console.log(error);
            next(new HttpException(400, error));
        }
    })
    .get('/balance/:user_id/:product_id', async(req: Request, res: Response, next: NextFunction) => {
        try {
            const response = await DashboardService.balance(req.params.user_id, req.params.product_id);
            res.status(200).json(response);
        } catch (error) {
            console.log(error);
            next(new HttpException(400, error));
        }
    });
    
