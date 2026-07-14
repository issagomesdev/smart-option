import express, { NextFunction, Request, Response } from "express";
import { NetworkService } from "../../services/network.service";
import { validate } from "../../infrastructure/http/middlewares/validate";
import { networkFiltersDto, networkIdParamDto } from "../../interfaces/http/dtos/admin.dto";
import { ok } from "../../shared/http/response";

export default express
  .Router()
  .post(
    "/:id",
    validate({ params: networkIdParamDto, body: networkFiltersDto }),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        ok(res, await NetworkService.network(Number(req.params.id), req.body));
      } catch (error) {
        next(error);
      }
    },
  );
