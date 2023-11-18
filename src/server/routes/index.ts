import express from "express";
import { Application } from "express";
const apiBasePath = process.env.API_BASE_PATH; //SERVIDOR AWS
//const apiBasePath = ''; //LOCAL

export default function routes(app: Application): void {
	
	app.use(express.static("public"));
}
