import { ConflictError, ForbiddenError } from "../errors";

/**
 * Catálogo fixo de permissões — não um catálogo normalizado
 * (`permissions`+`role_permissions`) de propósito: 6 chaves, cada uma
 * justificada 1:1 contra uma ação de escrita sensível real do sistema
 * (achado da pesquisa da Fase 5 do painel admin). Leitura fica aberta a
 * qualquer staff autenticado; só estas ações exigem a permissão
 * correspondente. `staff.manage`/`roles.manage` são separadas de propósito
 * (separação de responsabilidade: "pode admitir/desligar gente" ≠ "pode
 * redefinir o que cada papel pode fazer").
 */
export const PERMISSIONS = [
  "users.write",
  "finance.adjust",
  "withdrawals.approve",
  "support.write",
  "staff.manage",
  "roles.manage",
  // Catálogo de planos: criar/editar/excluir produtos. Justifica uma chave própria porque
  // `products.price`/`earnings_monthly` alimentam lógica financeira viva — `applyEarningsDaily`
  // (`src/server/cron.ts:94-127`) calcula o rendimento diário de todos os assinantes a partir de
  // `earnings_monthly`, então editar um plano move dinheiro real. Leitura segue aberta.
  "plans.manage",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export function isPermission(value: string): value is Permission {
  return (PERMISSIONS as readonly string[]).includes(value);
}

/**
 * Guarda contra auto-escalação: um staff só pode conceder (atribuindo um
 * papel a alguém, ou editando o array de permissões de um papel) permissões
 * que ele mesmo já possui. Sem isso, um portador só de `roles.manage`
 * poderia editar o papel `admin` para incluir qualquer coisa, inclusive para
 * si mesmo.
 */
export function assertCanGrant(actorPermissions: readonly Permission[], targetPermissions: readonly Permission[]): void {
  const actorSet = new Set(actorPermissions);
  const ungranted = targetPermissions.filter((permission) => !actorSet.has(permission));

  if (ungranted.length > 0) {
    throw new ForbiddenError(`Você não pode conceder permissões que não possui: ${ungranted.join(", ")}`);
  }
}

/**
 * Guarda contra lockout do último admin — chamada nos 3 pontos de mutação
 * que poderiam zerar a contagem de staff ativo com `staff.manage`: desativar
 * staff, reatribuir o papel de um staff, editar o array de permissões de um
 * papel removendo `staff.manage`. A contagem em si (quantos staff ativos
 * ficariam com `staff.manage` depois da mudança) é responsabilidade de quem
 * chama — mantém esta função pura e testável sem acesso a banco.
 */
export function assertStaffManageSurvives(activeStaffManageCountAfterChange: number): void {
  if (activeStaffManageCountAfterChange < 1) {
    throw new ConflictError("Essa ação deixaria o sistema sem nenhum staff com permissão para gerenciar a equipe.");
  }
}
