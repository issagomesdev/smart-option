export interface PaginationParams {
  page: number;
  limit: number;
  /** Chave de coluna (validada contra uma allowlist por serviço, ver `shared/http/sorting.ts`) — nunca usada direto num identificador SQL. */
  sortBy?: string;
  sortDirection?: "asc" | "desc";
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PaginatedResult<T> {
  data: T[];
  pagination: PaginationMeta;
}

export function offsetFor(params: PaginationParams): number {
  return (params.page - 1) * params.limit;
}

export function paginate<T>(data: T[], params: PaginationParams, total: number): PaginatedResult<T> {
  return {
    data,
    pagination: {
      page: params.page,
      limit: params.limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / params.limit)),
    },
  };
}
