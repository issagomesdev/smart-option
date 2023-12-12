
import { NetworkService } from "../../services/network.service";
import express from "express";
import { NextFunction, Request, Response } from "express";
import { HttpException } from "../../exceptions/http.exception";

export default express
  .Router()
    .get('/:id', async(req: Request, res: Response, next: NextFunction) => {
    try {
        const response = await NetworkService.network(Number(req.params.id));
        res.status(200).json(response);
    } catch (error) {
        console.log(error);
        next(new HttpException(400, error));
    }
    });
    
