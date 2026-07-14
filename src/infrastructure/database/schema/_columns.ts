import { bigint, decimal, timestamp } from "drizzle-orm/mysql-core";

/** PK padrão de todas as tabelas: bigint autoincrement. */
export const idColumn = () => bigint("id", { mode: "number", unsigned: true }).autoincrement().primaryKey();

/** FK padrão para outra tabela com PK `idColumn()`. */
export const refIdColumn = (name: string) => bigint(name, { mode: "number", unsigned: true });

export const createdAtColumn = () => timestamp("created_at").notNull().defaultNow();

export const updatedAtColumn = () => timestamp("updated_at").notNull().defaultNow().onUpdateNow();

/** Marcador de soft delete — presença de valor = registro removido logicamente. */
export const deletedAtColumn = () => timestamp("deleted_at");

/** Valores monetários em BRL. Precisão suficiente para qualquer saldo realista da plataforma. */
export const moneyColumn = (name: string) => decimal(name, { precision: 14, scale: 2 });
