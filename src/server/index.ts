import bodyParser from "body-parser";
import express, { Application } from "express";
import helmet from "helmet";
import http from "http";
import { errorHandler } from "./middlewares/error.handler";
import cors from "cors";
import path from "path";
import { dailyCron, everyMinuteCron, lastDayinMonthCron } from "./cron";

const app = express();

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(helmet());

export default class ExpressServer {
	server: http.Server;

	constructor() {
		const root = path.normalize(`${__dirname}/../..`);
		const corsOptions = {
			exposedHeaders: ["x-access-token", "Authorization"],
			origin: "*",
			methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
			optionsSuccessStatus: 200
		};
		app.use(cors(corsOptions));
	}

	router(routes: (app: Application) => void): ExpressServer {
		routes(app);
		app.use(errorHandler);
		return this;
	}

	listen(p: string | number = process.env.PORT): Application {
		const welcome = (port) => () => console.log(`Up and running on port: ${port}!`);
		this.server = http.createServer(app);
		this.server.listen(p, welcome(p));
		dailyCron.start();
		everyMinuteCron.start();
		lastDayinMonthCron.start();
		return app;
	}
}
