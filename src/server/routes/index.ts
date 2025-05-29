import express from "express";
import { Application } from "express";
import { authorize } from "../middlewares/auth.interceptor";
import validateEmailRoute from "./validateEmail.routes";
import transactions from "./transactions.routes";
import authRoute from "./auth.routes";
import usersRoute from "./users.routes";
import requestsRoute from "./requests.routes";
import networkRoute from "./network.routes";
import dashRoute from "./dash.routes";

export default function routes(app: Application): void {
	app.use(`/api/auth`, authRoute);
	app.use(`/api/users`, authorize(), usersRoute); 
	app.use(`/api/requests`, authorize(), requestsRoute);
	app.use(`/api/network`, authorize(), networkRoute);
	app.use(`/api/dashboard`, authorize(), dashRoute);
	app.use(`/email/verify`, validateEmailRoute);
	app.use(`/transactions`, transactions);
	app.use(express.static("public"));
}
