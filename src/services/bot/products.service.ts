import { db } from "../../infrastructure/database/client";
import { products } from "../../infrastructure/database/schema";

export class ProductsService {
  static async products() {
    return db.select().from(products);
  }
}
