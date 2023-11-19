import mysql from "mysql2/promise";
import dotenv from 'dotenv';
dotenv.config();

const conn = mysql.createPool({
	host: process.env.DB_HOST,
	user: process.env.DB_USER,
	password: process.env.DB_PASSWORD,
	database: process.env.DB_DATABASE,
	port: parseInt(process.env.DB_PORT || '3306'),
	waitForConnections: true,
	connectionLimit: 10,
	queueLimit: 0,
  });

export default conn;
