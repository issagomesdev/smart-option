

import express from "express";
import { Application } from "express";
import { authorize } from "../middlewares/auth.interceptor";
import validateEmailRoute from "./validateEmail.routes";
import transactions from "./transactions.routes";
import authRoute from "./auth.routes";
import usersRoute from "./users.routes";
import financialRoute from "./financial.routes";
import networkRoute from "./network.routes";

export default function routes(app: Application): void {
	app.use(`/api/auth`, authRoute);
	app.use(`/api/users`, authorize("1"), usersRoute);
	app.use(`/api/financial`, authorize("1"), financialRoute);
	app.use(`/api/network`, authorize("1"), networkRoute);
	app.use(`/email/verify`, validateEmailRoute);
	app.use(`/transactions`, transactions);
	app.use(express.static("public"));
}
