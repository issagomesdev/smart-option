

import express from "express";
import { Application } from "express";
import validateEmailRoute from "./validateEmail.routes";
import transactions from "./transactions.routes";

export default function routes(app: Application): void {
	app.use(`/email/verify`, validateEmailRoute);
	app.use(`/transactions`, transactions);
	app.use(express.static("public"));
}
