import "./config/env";
import Server from "./server/index";
import routes from "./server/routes";
import { start } from "./bot";

const port = 3000; 
export default new Server().router(routes).listen(port);
//start();