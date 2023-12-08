import { Request, Response, NextFunction } from "express";
import { verify } from "jsonwebtoken";
import conn from "../../db";
import { httpErrors } from "../../exceptions/http.exception";

const HTTP_NOT_AUTHORIZED = { auth: false, error: httpErrors(401) },
	HTTP_FORBIDDEN = { auth: false, error: httpErrors(402) };

export const authenticateToken = async (token: string): Promise<any | null> => {
	try {
		let id: string;
		try {
			const data:any = verify(token, process.env.SECRET_KEY);
			if (data) id = data.user.id;
		} catch (err) {
			console.error(err);
			return null;
		}
		const user = (await conn.query(`SELECT name, surname, email, role_id, created_at FROM users where id = ${id}`))[0][0];

		return user || null;
	} catch (error) {
		console.error(error);
		return null;
	}
};

export const authorize = (...allowed: string[]) => {
	const isAllowed = (Type) => allowed.indexOf(Type) > -1 || allowed.indexOf("all") > -1;

	return async (req: any, res: Response, next: NextFunction) => {
		if (req.header("Authorization")) {

			const token = req.header("Authorization").replace("Bearer ", "");

			if (!token) {
				console.log(`token not found`);
				res.status(401).json(HTTP_NOT_AUTHORIZED);
				next();
				return;
			}
			const user = await authenticateToken(token);

			if (!user) {
				console.log(`user not found`);
				res.status(401).json(HTTP_NOT_AUTHORIZED);
				next();
				return;
			}

			// if (!(user && isAllowed(user.Type))) {
			// 	console.log(`user not allowed to access this route`);
			// 	res.status(402).json(HTTP_FORBIDDEN);
			// }

			req.user = user;

			next();
		} else {
			res.status(401).json(HTTP_NOT_AUTHORIZED);
			next();
		}
	};
};
