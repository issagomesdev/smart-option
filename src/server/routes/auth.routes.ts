
import { AuthenticationService } from "../../services/authentication.service";
import express from "express";
import { NextFunction, Request, Response } from "express";
import { HttpException } from "../../exceptions/http.exception";

export default express
  .Router()
  .post('/', async(req: Request, res: Response, next: NextFunction) => {
    const { email, password } = req.body;
    try {
        const response = await AuthenticationService.login(email, password);
        res.status(200).json(response);
    } catch (error) {
        console.log(error);
        next(new HttpException(400, error));
    }

    });