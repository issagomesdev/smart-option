
import { AuthenticationService } from "../../services/authentication.service";
import express from "express";
import { NextFunction, Request, Response } from "express";
import { HttpException } from "../../exceptions/http.exception";
import jwt from 'jsonwebtoken';
import conn from "../../db";


export default express
  .Router()
  .post('/', async(req: Request, res: Response, next: NextFunction) => {
    const { email, password, remember } = req.body;
    try {
        const response = await AuthenticationService.login(email, password, remember);
        res.status(200).json(response);
    } catch (error) {
        console.log(error);
        next(new HttpException(400, error));
    }

    })
  .post('/token', async(req: Request, res: Response, next: NextFunction) => {
    const token = req.headers.authorization.split(' ')[1]
    
    if (!token) {
      return res.status(200).json({ message: 'Token inválido' });
    }
    
    jwt.verify(token, process.env.SECRET_KEY, async(err:any, decoded:any) => {
      
      if (err) {
        return res.status(200).json({ message: 'Falha na autenticação do token' });
      }

      const user = (
        await conn.query(`SELECT * FROM users where id = ${decoded.userId}`)
      )[0][0];

      delete user.password;

      return res.status(200).json({ message: 'Token validado com sucesso', user: user });
     
    });

  });