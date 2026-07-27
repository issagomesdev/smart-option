/**
 * Um `sql<T>\`${column}\`.as(alias)` bruto (necessário para dar um alias de coluna dentro de um
 * `unionAll` — uma referência de coluna nativa do Drizzle não é aliasável do mesmo jeito, e sem
 * alias a comparação/ordenação entre branches com nomes de coluna diferentes não funciona) perde a
 * conversão de tipo automática que uma referência de coluna tipada carrega: o mysql2 devolve o valor
 * cru como veio do driver — uma string `"YYYY-MM-DD HH:mm:ss"` (o wall-clock em UTC, já que o pool
 * está com `timezone: "Z"` em `infrastructure/database/client.ts`), sem indicação de fuso. `new
 * Date(...)` direto nessa string seria interpretado como hora LOCAL do processo, não UTC — a mesma
 * classe de bug corrigida em `shared/http/period.ts#parseDateInput`, confirmada empiricamente
 * (`TIMESTAMPDIFF` batendo horas de diferença entre o valor cru e o instante real inserido). Trocar
 * o espaço por `T` e acrescentar `Z` reconstrói o instante UTC correto antes de virar `Date`.
 */
export function parseSqlDateTime(value: string): Date {
  return new Date(`${value.replace(" ", "T")}Z`);
}
