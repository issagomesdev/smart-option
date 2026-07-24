import express, { NextFunction, Request, Response } from "express";
import { UsersService } from "../../services/users.service";
import { RegisterService } from "../../services/bot/register.service";
import { validate } from "../../infrastructure/http/middlewares/validate";
import {
  botUserIdParamDto,
  botUserSearchParamDto,
  botUserStatusParamsDto,
  botUsersFiltersDto,
  transfValuesAdminDto,
  updateBotUserDto,
  updatePassDto,
  updateStaffUserDto,
} from "../../interfaces/http/dtos/admin.dto";
import { ok } from "../../shared/http/response";
import { UnauthorizedError } from "../../shared/errors";
import { requirePermission } from "../middlewares/auth.interceptor";

export default express
  .Router()
  .patch("/update-user", validate({ body: updateStaffUserDto }), async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) throw new UnauthorizedError();
      ok(res, await UsersService.updateUser(req.user.id, req.body));
    } catch (error) {
      next(error);
    }
  })
  .patch("/update-pass", validate({ body: updatePassDto }), async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) throw new UnauthorizedError();
      ok(res, await UsersService.updatePass(req.user.id, req.body));
    } catch (error) {
      next(error);
    }
  })
  .get("/users-bot/:search", validate({ params: botUserSearchParamDto }), async (req: Request, res: Response, next: NextFunction) => {
    try {
      ok(res, await UsersService.botUsers(req.params.search));
    } catch (error) {
      next(error);
    }
  })
  .post("/users-bot", validate({ body: botUsersFiltersDto }), async (req: Request, res: Response, next: NextFunction) => {
    try {
      ok(res, await UsersService.botUsers("all", req.body));
    } catch (error) {
      next(error);
    }
  })
  .get("/user-bot/:id", validate({ params: botUserIdParamDto }), async (req: Request, res: Response, next: NextFunction) => {
    try {
      ok(res, await UsersService.botUser(req.params.id));
    } catch (error) {
      next(error);
    }
  })
  .post("/user-bot", requirePermission("users.write"), async (req: Request, res: Response, next: NextFunction) => {
    try {
      ok(res, await RegisterService.registerUser(req.body));
    } catch (error) {
      next(error);
    }
  })
  .patch(
    "/user-bot",
    requirePermission("users.write"),
    validate({ body: updateBotUserDto }),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        ok(res, await UsersService.updateBotUser(req.body));
      } catch (error) {
        next(error);
      }
    },
  )
  .delete(
    "/user-bot/:id",
    requirePermission("users.write"),
    validate({ params: botUserIdParamDto }),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        ok(res, await UsersService.deleteBotUser(Number(req.params.id)));
      } catch (error) {
        next(error);
      }
    },
  )
  .put(
    "/user-bot/:id/:status",
    requirePermission("users.write"),
    validate({ params: botUserStatusParamsDto }),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        ok(res, await UsersService.isActiveBotUser(Number(req.params.id), Number(req.params.status)));
      } catch (error) {
        next(error);
      }
    },
  )
  .post(
    "/transf-user-admin",
    requirePermission("finance.adjust"),
    validate({ body: transfValuesAdminDto }),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        ok(res, await UsersService.transfValuesAdmin(req.body, req.user));
      } catch (error) {
        next(error);
      }
    },
  );
