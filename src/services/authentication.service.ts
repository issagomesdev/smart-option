import HttpException, { httpErrors } from "../exceptions/http.exception";
import jwt from "jsonwebtoken";
import conn from "../db";
import { SHA1 } from "crypto-js";

export class AuthenticationService {

	static async login(email: string, password: string, remember: boolean = false): Promise<any> {
		try { 
			const user:any = (
				await conn.query(`SELECT * FROM users where email = '${email}'`)
			)[0][0];
			
			if (!user) throw Error("Email e/ou senha inválidos");
			if (user.password != SHA1(password)) throw Error("Email e/ou senha inválidos");

			const token = jwt.sign(
				{ userId: user.id }, 
				process.env.SECRET_KEY, 
				{ expiresIn: remember? "1d" : "30m"},
			);
			
			delete user.password;
			return { auth: true, token, user };
		} catch (error) {
			console.log(error);
			throw error;
		}
	}

}


