
import { UsersService } from "../../services/users.service";
import express from "express";
import { NextFunction, Request, Response } from "express";
import { HttpException } from "../../exceptions/http.exception";

export default express
  .Router()
  .get('/', async(req: Request, res: Response, next: NextFunction) => {
    try {
        const response = await UsersService.users();
        res.status(200).json(response);
    } catch (error) {
        console.log(error);
        next(new HttpException(400, error));
    }

    });