import { inArray, like, sql } from "drizzle-orm";
import { db } from "../client";
import {
  affiliateNetwork,
  auditLogs,
  botUsers,
  checkouts,
  supportRequests,
  userPlans,
  walletTransactions,
  wallets,
  withdrawals,
} from "../schema";
import { logger } from "../../../shared/logger";
import { applyDirection, fromCents, toCents } from "../../../wallet/wallet.math";

/**
 * Gerador de dados de demonstração — o que faz o painel parecer um sistema em produção em vez de
 * uma instalação vazia.
 *
 * Duas propriedades importam mais que o volume:
 *
 * 1. **Cenário determinístico.** O PRNG tem semente fixa, então a *forma* do cenário se repete a
 *    cada reset: os mesmos usuários aderem aos mesmos planos, com os mesmos valores e a mesma
 *    árvore de afiliados. Só variam os identificadores (e-mail/Telegram levam um carimbo de tempo
 *    para não colidir na unique constraint quando `demo:seed` roda sem reset antes) e as datas, que
 *    são relativas a "agora". Na prática: o dashboard fica reconhecível entre resets, sem depender
 *    de `Math.random()`, que tornaria cada execução um cenário diferente.
 * 2. **Coerência contábil.** Cada linha de `wallet_transactions` carrega o `balance_after` real, e
 *    `wallets.balance` termina exatamente igual à soma do ledger. Sem isso o KPI "Saldo da rede" do
 *    dashboard (que lê o saldo materializado) contradiria a Auditoria Financeira (que lê o ledger),
 *    e a demonstração exibiria um sistema visivelmente quebrado.
 *
 * Toda aritmética monetária passa por `toCents`/`fromCents` (`wallet/wallet.math.ts`) — somar reais
 * em float acumularia centavos de erro ao longo de milhares de lançamentos e quebraria a
 * propriedade (2).
 */

const SEED = 20260726;
const USER_COUNT = 300;
const MONTHS_OF_HISTORY = 8;

/** PRNG determinístico (mulberry32) — `Math.random()` tornaria cada reset um cenário diferente. */
function createRandom(seed: number) {
  let state = seed >>> 0;
  return function random(): number {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const FIRST_NAMES = [
  "Ana", "Bruno", "Carla", "Diego", "Eduarda", "Felipe", "Gabriela", "Henrique", "Isabela", "João",
  "Karina", "Lucas", "Mariana", "Nicolas", "Olívia", "Pedro", "Queila", "Rafael", "Sofia", "Thiago",
  "Ursula", "Vinícius", "Wesley", "Yasmin", "Zeca", "Beatriz", "Caio", "Daniela", "Enzo", "Fernanda",
];
const LAST_NAMES = [
  "Silva", "Santos", "Oliveira", "Souza", "Lima", "Pereira", "Costa", "Rodrigues", "Almeida",
  "Nascimento", "Carvalho", "Araújo", "Ribeiro", "Fernandes", "Gomes", "Martins", "Rocha", "Barbosa",
];
const CITIES = [
  "São Paulo", "Rio de Janeiro", "Belo Horizonte", "Curitiba", "Porto Alegre", "Salvador",
  "Recife", "Fortaleza", "Brasília", "Manaus", "Goiânia", "Florianópolis",
];
const SUPPORT_SUBJECTS = [
  "Não consegui finalizar meu depósito via PIX, o QR Code expirou.",
  "Gostaria de entender melhor como funciona o bônus de rentabilidade.",
  "Meu saque está pendente há dois dias, podem verificar?",
  "Como faço para atualizar minha chave PIX cadastrada?",
  "Tenho interesse no plano Smart Bot, como funciona a contratação?",
  "Quero saber quantos afiliados tenho no nível 2.",
  "O rendimento de ontem não apareceu no meu extrato.",
  "Consigo trocar de plano sem perder o saldo acumulado?",
];

/** Planos AUTO semeados, com o preço que `plans.seed.ts` fixa — usados para adesões coerentes. */
const AUTO_PLANS = [
  { id: 1, price: 97, earningsMonthly: 4 },
  { id: 2, price: 197, earningsMonthly: 6 },
  { id: 3, price: 297, earningsMonthly: 8 },
  { id: 4, price: 297, earningsMonthly: 8 },
];

interface LedgerDraft {
  userId: number;
  direction: "credit" | "debit";
  origin:
    | "deposit"
    | "withdrawal"
    | "earnings"
    | "profitability"
    | "subscription"
    | "transfer_in"
    | "transfer_out"
    | "admin_adjustment";
  amountCents: number;
  createdAt: Date;
  referenceType?: string;
  referenceId?: string;
}

function pick<T>(random: () => number, items: readonly T[]): T {
  return items[Math.floor(random() * items.length)]!;
}

function randomInt(random: () => number, min: number, max: number): number {
  return Math.floor(random() * (max - min + 1)) + min;
}

/** Insere em lotes — 300 usuários com meses de histórico geram milhares de linhas. */
async function insertInChunks<T>(
  table: Parameters<typeof db.insert>[0],
  rows: T[],
  chunkSize = 500,
): Promise<void> {
  for (let index = 0; index < rows.length; index += chunkSize) {
    const chunk = rows.slice(index, index + chunkSize);
    if (chunk.length > 0) await db.insert(table).values(chunk as never);
  }
}

export interface DemoSeedSummary {
  users: number;
  ledgerEntries: number;
  checkouts: number;
  withdrawals: number;
  supportRequests: number;
}

export async function seedDemoData(): Promise<DemoSeedSummary> {
  const random = createRandom(SEED);
  const now = new Date();
  const historyStart = new Date(now);
  historyStart.setMonth(historyStart.getMonth() - MONTHS_OF_HISTORY);

  // --- 1. Usuários -----------------------------------------------------------------------------
  const stamp = Date.now();
  const userRows = Array.from({ length: USER_COUNT }, (_unused, index) => {
    const first = pick(random, FIRST_NAMES);
    const last = pick(random, LAST_NAMES);
    // Cadastro espalhado pelo período — evita 300 usuários com a mesma data de entrada.
    const createdAt = new Date(historyStart.getTime() + random() * (now.getTime() - historyStart.getTime()));
    return {
      name: `${first} ${last}`,
      email: `demo.${index + 1}.${stamp}@exemplo.com.br`,
      password: "demo-nao-utilizavel",
      phoneNumber: `11 9${randomInt(random, 1000, 9999)}-${randomInt(random, 1000, 9999)}`,
      adress: `Rua ${pick(random, LAST_NAMES)}, ${randomInt(random, 10, 1999)} — ${pick(random, CITIES)}`,
      pixCode: `demo.${index + 1}.${stamp}@exemplo.com.br`,
      telegramUserId: `${900000000 + index}${stamp % 1000}`,
      isActive: random() > 0.06,
      createdAt,
      verifiedEmailAt: random() > 0.15 ? createdAt : null,
      lastActivity: new Date(createdAt.getTime() + random() * (now.getTime() - createdAt.getTime())),
    };
  });

  await insertInChunks(botUsers, userRows);

  // Relê APENAS os usuários criados nesta execução, filtrando pelo carimbo de tempo no e-mail.
  // Ler a tabela inteira quebraria `demo:seed` num banco já povoado: tentaria criar carteira para
  // usuários que já têm uma, violando a unique de `wallet.user_id`. Antes isso passava despercebido
  // porque só o `demo:reset` (que trunca tudo antes) exercitava este caminho.
  const emailPattern = `demo.%.${stamp}@exemplo.com.br`;
  const insertedUsers = await db
    .select({ id: botUsers.id, createdAt: botUsers.createdAt })
    .from(botUsers)
    .where(like(botUsers.email, emailPattern));
  const users = insertedUsers.sort((a, b) => a.id - b.id);
  const seededUserIds = users.map((user) => user.id);

  // --- 2. Carteiras (saldo preenchido no fim, a partir do ledger) -------------------------------
  await insertInChunks(
    wallets,
    users.map((user) => ({ userId: user.id, balance: "0.00" })),
  );
  const walletRows = await db
    .select({ id: wallets.id, userId: wallets.userId })
    .from(wallets)
    .where(inArray(wallets.userId, seededUserIds));
  const walletIdByUser = new Map(walletRows.map((wallet) => [wallet.userId, wallet.id]));

  // --- 3. Rede de afiliados (3 níveis) ----------------------------------------------------------
  // Cada usuário (menos os primeiros) recebe um patrocinador entre os que entraram antes dele, o
  // que produz uma árvore realista em vez de ligações aleatórias que criariam ciclos.
  const sponsorOf = new Map<number, number>();
  const networkRows: { affiliateUserId: number; guestUserId: number; level: "1" | "2" | "3" }[] = [];

  users.forEach((user, index) => {
    if (index < 5 || random() > 0.75) return;
    const sponsor = users[randomInt(random, 0, index - 1)]!;
    sponsorOf.set(user.id, sponsor.id);

    let current: number | undefined = sponsor.id;
    for (const level of ["1", "2", "3"] as const) {
      if (!current) break;
      networkRows.push({ affiliateUserId: current, guestUserId: user.id, level });
      current = sponsorOf.get(current);
    }
  });
  await insertInChunks(affiliateNetwork, networkRows);

  // --- 4. Planos, cobranças, saques e ledger ----------------------------------------------------
  const planRows: { userId: number; productId: number; status: number; acquiredIn: Date; expiredIn: Date }[] = [];
  const checkoutRows: {
    referenceId: string;
    type: "deposit" | "subscription";
    value: string;
    status: "PENDING" | "PAID" | "IN_ANALYSIS" | "CANCELED";
    productId?: number;
    userId: number;
    createdAt: Date;
  }[] = [];
  const withdrawalRows: {
    userId: number;
    value: string;
    status: "pending" | "success" | "refused";
    referenceId: string;
    replyObservation?: string;
    createdAt: Date;
  }[] = [];
  const ledgerDrafts: LedgerDraft[] = [];
  const supportRows: { type: "support" | "service"; subject: string; isRead: number; userId: number; telegramUserId: number; createdAt: Date }[] = [];

  for (const user of users) {
    const joinedAt = user.createdAt ?? historyStart;
    // ~78% dos usuários movimentam de fato; o resto fica cadastrado e inativo, como num sistema real.
    if (random() > 0.78) continue;

    let balanceCents = 0;
    const events: LedgerDraft[] = [];

    // Depósito inicial.
    const firstDepositAt = new Date(joinedAt.getTime() + randomInt(random, 1, 72) * 3600_000);
    if (firstDepositAt > now) continue;
    const firstDeposit = randomInt(random, 100, 5000);
    events.push({
      userId: user.id,
      direction: "credit",
      origin: "deposit",
      amountCents: toCents(firstDeposit),
      createdAt: firstDepositAt,
      referenceType: "checkout",
    });
    checkoutRows.push({
      referenceId: `demo-dep-${user.id}-1`,
      type: "deposit",
      value: firstDeposit.toFixed(2),
      status: "PAID",
      userId: user.id,
      createdAt: firstDepositAt,
    });

    // Adesão a um plano (a maioria adere).
    const buysPlan = random() > 0.25;
    let plan: (typeof AUTO_PLANS)[number] | null = null;
    let planAcquiredAt: Date | null = null;

    if (buysPlan) {
      plan = pick(random, AUTO_PLANS);
      planAcquiredAt = new Date(firstDepositAt.getTime() + randomInt(random, 1, 96) * 3600_000);
      if (planAcquiredAt < now) {
        events.push({
          userId: user.id,
          direction: "debit",
          origin: "subscription",
          amountCents: toCents(plan.price),
          createdAt: planAcquiredAt,
          referenceType: "checkout",
        });
        checkoutRows.push({
          referenceId: `demo-sub-${user.id}`,
          type: "subscription",
          value: plan.price.toFixed(2),
          status: "PAID",
          productId: plan.id,
          userId: user.id,
          createdAt: planAcquiredAt,
        });

        const expiredIn = new Date(planAcquiredAt);
        expiredIn.setMonth(expiredIn.getMonth() + 1);
        planRows.push({
          userId: user.id,
          productId: plan.id,
          // Plano vencido vira status 0 — alimenta o KPI "usuários ativos" com variação real.
          status: expiredIn > now ? 1 : random() > 0.45 ? 1 : 0,
          acquiredIn: planAcquiredAt,
          expiredIn: expiredIn > now ? expiredIn : new Date(now.getTime() + randomInt(random, 1, 40) * 86_400_000),
        });
      } else {
        plan = null;
      }
    }

    // Rendimento diário enquanto o plano esteve ativo (dias úteis, como `applyEarningsDaily`).
    if (plan && planAcquiredAt) {
      const cursor = new Date(planAcquiredAt);
      cursor.setDate(cursor.getDate() + 1);
      const dailyRate = plan.earningsMonthly / 22 / 100;

      while (cursor < now) {
        const weekday = cursor.getDay();
        if (weekday !== 0 && weekday !== 6) {
          const runningBalance = Number(fromCents(balanceCents + sumCents(events)));
          const earnings = Math.round(runningBalance * dailyRate * 100) / 100;
          if (earnings > 0.01) {
            events.push({
              userId: user.id,
              direction: "credit",
              origin: "earnings",
              amountCents: toCents(earnings),
              createdAt: new Date(cursor),
            });

            // Repasse de rentabilidade para o patrocinador (o que alimenta o gráfico do dashboard).
            const sponsor = sponsorOf.get(user.id);
            if (sponsor) {
              const repass = Math.round(earnings * 0.07 * 100) / 100;
              if (repass > 0.01) {
                ledgerDrafts.push({
                  userId: sponsor,
                  direction: "credit",
                  origin: "profitability",
                  amountCents: toCents(repass),
                  createdAt: new Date(cursor),
                });
              }
            }
          }
        }
        cursor.setDate(cursor.getDate() + randomInt(random, 1, 3));
      }
    }

    // Depósitos avulsos ao longo do tempo.
    for (let index = 0; index < randomInt(random, 0, 4); index += 1) {
      const at = new Date(joinedAt.getTime() + random() * (now.getTime() - joinedAt.getTime()));
      const value = randomInt(random, 50, 3000);
      events.push({ userId: user.id, direction: "credit", origin: "deposit", amountCents: toCents(value), createdAt: at, referenceType: "checkout" });
      checkoutRows.push({
        referenceId: `demo-dep-${user.id}-${index + 2}`,
        type: "deposit",
        value: value.toFixed(2),
        status: "PAID",
        userId: user.id,
        createdAt: at,
      });
    }

    ledgerDrafts.push(...events);
    balanceCents = sumCents(events);

    // Saque concluído, só se houver saldo suficiente.
    if (random() > 0.62 && balanceCents > toCents(150)) {
      const at = new Date(now.getTime() - randomInt(random, 2, 120) * 86_400_000);
      const value = Math.min(Number(fromCents(balanceCents)) * 0.35, randomInt(random, 50, 900));
      const rounded = Math.round(value * 100) / 100;
      if (rounded > 10) {
        ledgerDrafts.push({
          userId: user.id,
          direction: "debit",
          origin: "withdrawal",
          amountCents: toCents(rounded),
          createdAt: at,
          referenceType: "withdrawal",
        });
        withdrawalRows.push({
          userId: user.id,
          value: rounded.toFixed(2),
          status: "success",
          referenceId: `demo-wd-${user.id}`,
          createdAt: at,
        });
      }
    }

    // Saque AINDA PENDENTE — alimenta o KPI "Saques pendentes" e o feed de movimentações em aberto.
    // Sem lançamento no ledger de propósito: só vira débito quando aprovado.
    if (random() > 0.9) {
      withdrawalRows.push({
        userId: user.id,
        value: randomInt(random, 80, 600).toFixed(2),
        status: "pending",
        referenceId: `demo-wd-pend-${user.id}`,
        createdAt: new Date(now.getTime() - randomInt(random, 0, 6) * 86_400_000),
      });
    }

    // Cobrança ainda pendente — alimenta o denominador do indicador "aprovadas hoje".
    if (random() > 0.88) {
      checkoutRows.push({
        referenceId: `demo-dep-pend-${user.id}`,
        type: "deposit",
        value: randomInt(random, 100, 800).toFixed(2),
        status: random() > 0.5 ? "PENDING" : "IN_ANALYSIS",
        userId: user.id,
        createdAt: new Date(now.getTime() - randomInt(random, 0, 3) * 86_400_000),
      });
    }

    // Tickets de suporte.
    if (random() > 0.82) {
      supportRows.push({
        type: random() > 0.7 ? "service" : "support",
        subject: pick(random, SUPPORT_SUBJECTS),
        isRead: random() > 0.5 ? 1 : 0,
        userId: user.id,
        telegramUserId: 900000000 + Number(user.id),
        createdAt: new Date(now.getTime() - randomInt(random, 0, 60) * 86_400_000),
      });
    }
  }

  await insertInChunks(userPlans, planRows);
  await insertInChunks(checkouts, checkoutRows);
  await insertInChunks(withdrawals, withdrawalRows);
  await insertInChunks(supportRequests, supportRows);

  // Relidos para obter os IDs reais: `audit_logs.entity_id` de um saque tem que apontar para o ID
  // do SAQUE. Usar o id do usuário aqui (como uma versão anterior deste seeder fazia) gera linhas
  // que casam por acidente com saques criados depois — inclusive os das suítes de integração, que
  // passaram a falhar de forma intermitente por causa disso.
  // Também escopado aos usuários desta execução — num banco já povoado, ler a tabela inteira geraria
  // linhas de auditoria para saques que não foram criados aqui.
  const insertedWithdrawals = await db
    .select({ id: withdrawals.id, userId: withdrawals.userId, value: withdrawals.value, status: withdrawals.status, createdAt: withdrawals.createdAt })
    .from(withdrawals)
    .where(inArray(withdrawals.userId, seededUserIds));

  // --- 5. Ledger em ordem cronológica, com balance_after correto por usuário --------------------
  // Ordenar globalmente por data e acumular por usuário é o que mantém `balance_after` coerente:
  // um lançamento gerado fora de ordem (ex.: repasse de rentabilidade do patrocinador) tem que
  // entrar no ponto certo da linha do tempo DELE, não no fim.
  ledgerDrafts.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

  const runningByUser = new Map<number, number>();
  const ledgerRows = ledgerDrafts.map((draft, index) => {
    const previous = runningByUser.get(draft.userId) ?? 0;
    const next = applyDirection(previous, draft.amountCents, draft.direction);
    runningByUser.set(draft.userId, next);

    return {
      walletId: walletIdByUser.get(draft.userId)!,
      userId: draft.userId,
      direction: draft.direction,
      origin: draft.origin,
      amount: fromCents(draft.amountCents),
      balanceAfter: fromCents(next),
      referenceType: draft.referenceType ?? null,
      referenceId: draft.referenceId ?? null,
      idempotencyKey: `demo:${index}:${draft.userId}:${draft.createdAt.getTime()}`,
      createdAt: draft.createdAt,
    };
  });

  await insertInChunks(walletTransactions, ledgerRows, 400);

  // --- 6. Saldo materializado = soma real do ledger ---------------------------------------------
  // A invariante que faz o dashboard e a auditoria contarem a mesma história. Recalculado com um
  // UPDATE ... JOIN sobre o próprio ledger recém-inserido, em vez de 300 UPDATEs individuais: além
  // de ser uma ida só ao banco, deriva o saldo da fonte da verdade (a tabela), não de um acumulador
  // em memória que poderia divergir dela.
  //
  // Restrito aos usuários desta execução: rodando `demo:seed` num banco já povoado, recalcular a
  // carteira de todo mundo mexeria no saldo de usuários reais que este script não criou.
  const seededIdList = sql.join(
    seededUserIds.map((id) => sql`${id}`),
    sql`, `,
  );
  await db.execute(sql`
    UPDATE ${wallets} w
    JOIN (
      SELECT user_id,
             SUM(CASE WHEN direction = 'credit' THEN amount ELSE -amount END) AS total
      FROM ${walletTransactions}
      WHERE user_id IN (${seededIdList})
      GROUP BY user_id
    ) t ON t.user_id = w.user_id
    SET w.balance = t.total
  `);

  // --- 7. Trilha de auditoria -------------------------------------------------------------------
  const auditRows = insertedWithdrawals
    .filter((withdrawal) => withdrawal.status === "success")
    .slice(0, 60)
    .map((withdrawal) => ({
      actorType: "staff_user" as const,
      actorId: 1,
      action: "withdrawal.approved",
      entityType: "withdrawals",
      entityId: String(withdrawal.id),
      after: { value: withdrawal.value },
      createdAt: new Date((withdrawal.createdAt ?? now).getTime() + 3600_000),
    }));
  await insertInChunks(auditLogs, auditRows);

  const summary: DemoSeedSummary = {
    users: userRows.length,
    ledgerEntries: ledgerRows.length,
    checkouts: checkoutRows.length,
    withdrawals: withdrawalRows.length,
    supportRequests: supportRows.length,
  };

  logger.info(summary, "Dados de demonstração gerados");
  return summary;
}

function sumCents(events: LedgerDraft[]): number {
  return events.reduce((total, event) => applyDirection(total, event.amountCents, event.direction), 0);
}
