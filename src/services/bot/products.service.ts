import conn from "../../db";

export class ProductsService {

  static async products(): Promise<any> {
    try {
        const products = (
            await conn.query(`SELECT * FROM products`)
        )[0];

        return products;
    } catch (error) {
      throw error;
    }
  }



}
