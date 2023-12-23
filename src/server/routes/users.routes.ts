
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

    })
    .patch('/update-user', async(req: Request, res: Response, next: NextFunction) => {
      try {
          const response = await UsersService.updateUser(req.body);
          res.status(200).json(response);
      } catch (error) {
          console.log(error);
          next(new HttpException(400, error));
      }

    })
   .patch('/update-pass', async(req: Request, res: Response, next: NextFunction) => {
      try {
          const response = await UsersService.updatePass(req.body);
          res.status(200).json(response);
      } catch (error) {
          console.log(error);
          next(new HttpException(400, error));
      }

    })
    .get('/users-bot/:search', async(req: Request, res: Response, next: NextFunction) => {
    try {
        const response = await UsersService.botUsers(req.params.search);
        res.status(200).json(response);
    } catch (error) {
        console.log(error);
        next(new HttpException(400, error));
    }

    })
    .post('/users-bot', async(req: Request, res: Response, next: NextFunction) => {
    try {
        const response = await UsersService.botUsers('all', req.body);
        res.status(200).json(response);
    } catch (error) {
        console.log(error);
        next(new HttpException(400, error));
    }

    })
    .get('/user-bot/:id', async(req: Request, res: Response, next: NextFunction) => {
    try {
        const response = await UsersService.botUser(req.params.id);
        res.status(200).json(response);
    } catch (error) {
        console.log(error);
        next(new HttpException(400, error));
    }

    })
    