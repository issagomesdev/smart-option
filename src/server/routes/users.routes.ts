
import { UsersService } from "../../services/users.service";
import { RegisterService } from "../../services/bot/register.service";
import express from "express";
import { NextFunction, Request, Response } from "express";
import { HttpException } from "../../exceptions/http.exception";

export default express
  .Router()
    .get('/', async(req: Request, res: Response, next: NextFunction) => { // Listagem de usuários (do painel)
    try {
        const response = await UsersService.users();
        res.status(200).json(response);
    } catch (error) {
        next(new HttpException(400, error));
    }

    })
    .patch('/update-user', async(req: Request, res: Response, next: NextFunction) => { // atualizar dados de um usuário (do painel)
      try {
          const response = await UsersService.updateUser(req.body);
          res.status(200).json(response);
      } catch (error) {
          next(new HttpException(400, error));
      }

    })
    .patch('/update-pass', async(req: Request, res: Response, next: NextFunction) => { // atualizar senha de um usuário (do painel)
      try {
          const response = await UsersService.updatePass(req.body);
          res.status(200).json(response);
      } catch (error) {
          next(new HttpException(400, error));
      }

    })
    .get('/users-bot/:search', async(req: Request, res: Response, next: NextFunction) => { // Listagem de usuários (do bot) com termo de busca
    try {
        const response = await UsersService.botUsers(req.params.search);
        res.status(200).json(response);
    } catch (error) {
        next(new HttpException(400, error));
    }

    })
    .post('/users-bot', async(req: Request, res: Response, next: NextFunction) => { // Listagem de usuários (do bot) com filtros
    try {
        const response = await UsersService.botUsers('all', req.body);
        res.status(200).json(response);
    } catch (error) {
        next(new HttpException(400, error));
    }

    })
    .get('/user-bot/:id', async(req: Request, res: Response, next: NextFunction) => { // Obtém dados de um usuário (do bot)
    try {
        const response = await UsersService.botUser(req.params.id);
        res.status(200).json(response);
    } catch (error) {
        next(new HttpException(400, error));
    }

    })
    .post('/user-bot', async(req: Request, res: Response, next: NextFunction) => { // Registrar um usuário (do bot)
    try {
        const response = await RegisterService.registerUser(req.body);
        res.status(200).json(response);
    } catch (error) {
        next(new HttpException(400, error));
    }

    })
    .patch('/user-bot', async(req: Request, res: Response, next: NextFunction) =>  { // Atualizar dados de um usuário (do bot)
    try {
        const response = await UsersService.updateBotUser(req.body);
        res.status(200).json(response);
    } catch (error) {
        next(new HttpException(400, error));
    }

    })
    .delete('/user-bot/:id', async(req: Request, res: Response, next: NextFunction) => { // Deletar um usuário (do bot)
    try {
        const response = await UsersService.deleteBotUser(Number(req.params.id));
        res.status(200).json(response);
    } catch (error) {
        next(new HttpException(400, error));
    }

    })
    .put('/user-bot/:id/:status', async(req: Request, res: Response, next: NextFunction) => { // Ativar ou desativar um usuário (do bot)
    try {
        const response = await UsersService.isActiveBotUser(Number(req.params.id), Number(req.params.status));
        res.status(200).json(response);
    } catch (error) {
        next(new HttpException(400, error));
    }

    })
    .post('/transf-user-admin', async(req: Request, res: Response, next: NextFunction) => { // Transferir valores para um usuário (do bot)
    try {
        const response = await UsersService.transfValuesAdmin(req.body);
        res.status(200).json(response);
    } catch (error) {
        next(new HttpException(400, error));
    }
    });
    