import { asc, desc, type AnyColumn, type SQL, type SQLWrapper } from "drizzle-orm";

export type SortDirection = "asc" | "desc";

export interface SortParams {
  sortBy?: string;
  sortDirection?: SortDirection;
}

/**
 * Resolve `sortBy`/`sortDirection` (vindos do cliente, texto livre) contra
 * uma allowlist fixa de colunas por recurso — nunca aceita um nome de coluna
 * arbitrário do cliente direto num `.orderBy()`. Uma chave desconhecida ou
 * ausente cai silenciosamente no `fallback` (nunca lança erro por causa de
 * ordenação, mesmo padrão "leitura nunca quebra por filtro estranho" já
 * usado nos filtros de texto livre desta API) — `sortDirection` ausente ou
 * inválido vira `asc`.
 */
export function resolveSort<K extends string>(
  columns: Record<K, AnyColumn | SQL | SQLWrapper>,
  params: SortParams | undefined,
  fallback: AnyColumn | SQL | SQLWrapper,
): SQL {
  const column = params?.sortBy && params.sortBy in columns ? columns[params.sortBy as K] : fallback;
  return params?.sortDirection === "desc" ? desc(column) : asc(column);
}
