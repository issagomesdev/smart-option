import { NextFunction, Request, Response } from 'express';

// eslint-disable-next-line no-unused-vars, no-shadow
export const errorHandler = function errorHandler(err:any, req: Request, res: Response, next: NextFunction) {
  const errors = err.errors || [{ message: err.message }];
  console.log(`${err.code || 500} ${errors.message}`);
  res.status(err.code || 500).json({ errors });
}
