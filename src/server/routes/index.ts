import express from "express";
import { Application } from "express";
import swaggerUi from "swagger-ui-express";
import { authorize } from "../middlewares/auth.interceptor";
import { healthRouter } from "../../infrastructure/http/routes/health.routes";
import { livenessRouter } from "../../infrastructure/http/routes/liveness.routes";
import { asaasWebhookRouter } from "../../interfaces/http/routes/asaas-webhook.routes";
import { openApiDocument } from "../../infrastructure/http/openapi";
import validateEmailRoute from "./validateEmail.routes";
import authRoute from "./auth.routes";
import usersRoute from "./users.routes";
import requestsRoute from "./requests.routes";
import networkRoute from "./network.routes";
import dashRoute from "./dash.routes";

export default function routes(app: Application): void {
	app.use(`/health`, livenessRouter);
	app.use(`/api/health`, healthRouter);
	app.use(`/api/docs`, swaggerUi.serve, swaggerUi.setup(openApiDocument));
	app.use(`/api/auth`, authRoute);
	app.use(`/api/users`, authorize(), usersRoute); 
	app.use(`/api/requests`, authorize(), requestsRoute);
	app.use(`/api/network`, authorize(), networkRoute);
	app.use(`/api/dashboard`, authorize(), dashRoute);
	app.use(`/email/verify`, validateEmailRoute);
	app.use(`/api/webhooks/asaas`, asaasWebhookRouter);
	app.use(express.static("public"));
}
