import express, { Application } from "express";
import cors from "cors";
import http from "http";
import { errorHandler } from "../infrastructure/http/middlewares/error-handler";
import { requestLogger } from "../infrastructure/http/middlewares/request-logger";
import { compressionMiddleware, corsOptions, globalRateLimiter, helmetMiddleware } from "../infrastructure/http/security";
import { isProduction } from "../config/env";
import { logger } from "../shared/logger";
import { dailyCron, everyMinuteCron, lastDayinMonthCron } from "./cron";
import { startDemoResetScheduler, stopDemoResetScheduler } from "./demo-reset.scheduler";

const app = express();

// Em produção a aplicação só é alcançada através do Nginx do
// docker-compose.prod.yml (1 hop) — confiar nesse único proxy é o que faz
// `req.ip`/`X-Forwarded-For` refletirem o IP real do cliente em vez do IP
// interno do container do Nginx, o que por sua vez é o que faz o rate
// limiter (por IP) tratar cada cliente separadamente em vez de agrupar todo
// mundo sob o IP do proxy.
app.set("trust proxy", isProduction ? 1 : false);

app.use(requestLogger);
app.use(helmetMiddleware);
app.use(compressionMiddleware);
app.use(cors(corsOptions));
app.use(globalRateLimiter);
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

export default class ExpressServer {
	server: http.Server;

	router(routes: (app: Application) => void): ExpressServer {
		routes(app);
		app.use(errorHandler);
		return this;
	}

	listen(p: string | number): ExpressServer {
		this.server = http.createServer(app);
		this.server.listen(p, () => logger.info({ port: p }, "Servidor HTTP no ar"));
		dailyCron.start();
		everyMinuteCron.start();
		lastDayinMonthCron.start();
		// Só agenda de fato com APP_DEMO=true e AUTO_RESET=true (ver `demo-reset.scheduler.ts`).
		startDemoResetScheduler();
		return this;
	}

	close(): Promise<void> {
		dailyCron.stop();
		everyMinuteCron.stop();
		lastDayinMonthCron.stop();
		stopDemoResetScheduler();

		return new Promise((resolve, reject) => {
			this.server.close((err) => (err ? reject(err) : resolve()));
		});
	}
}
