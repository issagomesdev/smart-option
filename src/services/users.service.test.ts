import { eq, inArray, like } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "../infrastructure/database/client";
import { botUsers, emailVerifications, staffUsers } from "../infrastructure/database/schema";
import { hashPassword } from "../shared/security/password";
import { UsersService } from "./users.service";

/**
 * Fase 0 (pré-requisito do painel admin): `POST /users-bot` (search="all")
 * passou a suportar `page`/`limit` server-side. Este teste garante que o
 * total bate com o conjunto inteiro filtrado e que as páginas não se
 * sobrepõem/pulam registros.
 */
describe("UsersService.botUsers (paginação, banco real)", () => {
  const stamp = Date.now();
  const namePrefix = `Pagination Bot User ${stamp}`;
  const userIds: number[] = [];

  beforeAll(async () => {
    for (let i = 0; i < 5; i++) {
      const [inserted] = await db
        .insert(botUsers)
        .values({
          name: `${namePrefix} ${i}`,
          email: `pagination-botuser-${stamp}-${i}@test.local`,
          password: "x",
          phoneNumber: "11900000000",
          adress: "Rua Teste, 1",
          pixCode: "chave-pix-teste",
        })
        .$returningId();
      userIds.push(inserted.id);
    }
  });

  afterAll(async () => {
    await db.delete(botUsers).where(like(botUsers.name, `${namePrefix}%`));
  });

  it("devolve o total real (5) mesmo pedindo uma página menor que o total", async () => {
    const result = await UsersService.botUsers("all", { name: namePrefix, page: 1, limit: 2 });

    expect(result.data).toHaveLength(2);
    expect(result.pagination).toEqual({ page: 1, limit: 2, total: 5, totalPages: 3 });
  });

  it("páginas consecutivas não se sobrepõem e cobrem todos os registros filtrados", async () => {
    const page1 = await UsersService.botUsers("all", { name: namePrefix, page: 1, limit: 2 });
    const page2 = await UsersService.botUsers("all", { name: namePrefix, page: 2, limit: 2 });
    const page3 = await UsersService.botUsers("all", { name: namePrefix, page: 3, limit: 2 });

    const allIds = [...page1.data, ...page2.data, ...page3.data].map((row) => row.id);
    expect(new Set(allIds).size).toBe(5);
    expect(allIds.sort((a, b) => a - b)).toEqual([...userIds].sort((a, b) => a - b));
    expect(page3.data).toHaveLength(1);
  });

  it("filtro de telegram (pós-processado em memória) ainda pagina corretamente", async () => {
    // Nenhum dos usuários de teste tem telegram vinculado, então o filtro
    // remove todos — cobre o caminho de fallback (paginação em memória).
    const result = await UsersService.botUsers("all", { name: namePrefix, telegram: "qualquercoisa", page: 1, limit: 2 });

    expect(result.data).toEqual([]);
    expect(result.pagination).toEqual({ page: 1, limit: 2, total: 0, totalPages: 1 });
  });

  it("busca por termo (GET /users-bot/:search) continua devolvendo array simples, sem paginação", async () => {
    const result = await UsersService.botUsers(userIds[0].toString());

    expect(Array.isArray(result)).toBe(true);
  });

  it("ordena por name asc/desc via sortBy/sortDirection (caminho rápido, SQL)", async () => {
    const asc = await UsersService.botUsers("all", { name: namePrefix, page: 1, limit: 10, sortBy: "name", sortDirection: "asc" });
    const desc = await UsersService.botUsers("all", { name: namePrefix, page: 1, limit: 10, sortBy: "name", sortDirection: "desc" });

    expect(asc.data.map((row) => row.name)).toEqual([...asc.data.map((row) => row.name)].sort());
    expect(desc.data.map((row) => row.name)).toEqual([...asc.data.map((row) => row.name)].sort().reverse());
  });

  /**
   * `telegram`/`balance` só existem depois do enriquecimento em JS — pedir
   * `sortBy=balance` força `needsPostFilter` (caminho lento) mesmo sem filtro
   * de telegram/balance. Também garante que o campo interno `created_at_raw`
   * (usado só para ordenar cronologicamente em memória) nunca vaza na resposta.
   */
  it("sortBy=balance força o caminho lento (pós-processado) sem quebrar a paginação nem vazar created_at_raw", async () => {
    const result = await UsersService.botUsers("all", { name: namePrefix, page: 1, limit: 2, sortBy: "balance", sortDirection: "desc" });

    expect(result.data).toHaveLength(2);
    expect(result.pagination.total).toBe(5);
    expect(result.data[0]).not.toHaveProperty("created_at_raw");
  });

  it("cai no fallback (id) quando sortBy é desconhecido, sem lançar erro", async () => {
    const result = await UsersService.botUsers("all", { name: namePrefix, page: 1, limit: 10, sortBy: "not-a-real-column" });
    expect(result.data).toHaveLength(5);
  });
});

/**
 * Regressão: `deleteBotUser` apagava `bot_users` antes das tabelas filhas
 * (`verification_email` etc.), o que viola a FK sempre que o usuário tem
 * qualquer linha relacionada — ou seja, praticamente todo usuário real, já
 * que `RegisterService.registerUser` sempre grava um `verification_email` no
 * cadastro. Reproduzido via painel admin (fluxo de excluir usuário) antes
 * desta correção.
 */
describe("UsersService.deleteBotUser (banco real)", () => {
  it("apaga um usuário com linhas filhas (verification_email) sem violar FK", async () => {
    const stamp = Date.now();
    const [inserted] = await db
      .insert(botUsers)
      .values({
        name: `Delete Test User ${stamp}`,
        email: `delete-botuser-${stamp}@test.local`,
        password: "x",
        phoneNumber: "11900000000",
        adress: "Rua Teste, 1",
        pixCode: "chave-pix-teste",
      })
      .$returningId();

    await db.insert(emailVerifications).values({ userId: inserted.id, token: "token-de-teste" });

    await expect(UsersService.deleteBotUser(inserted.id)).resolves.toEqual({
      status: true,
      message: "Usuário excluído com sucesso",
    });

    const [remainingUser] = await db.select({ id: botUsers.id }).from(botUsers).where(eq(botUsers.id, inserted.id));
    expect(remainingUser).toBeUndefined();

    const remainingVerifications = await db
      .select({ id: emailVerifications.id })
      .from(emailVerifications)
      .where(eq(emailVerifications.userId, inserted.id));
    expect(remainingVerifications).toEqual([]);
  });
});

/**
 * Regressão: um `telegram_user_id` inválido/desatualizado (conta apagada,
 * bot bloqueado, dado de teste sujo) fazia `bot.getChat` lançar
 * `ETELEGRAM: 400 chat not found`, e como a chamada não era protegida, isso
 * derrubava a listagem inteira com 500 — mesmo filtrando por um usuário sem
 * nenhuma relação com a linha problemática. Reproduzido via painel admin
 * (listagem de usuários) antes desta correção.
 */
describe("UsersService — telegram_user_id inválido não derruba a consulta (banco real, chama a API do Telegram de verdade)", () => {
  const stamp = Date.now();
  let userId: number;

  beforeAll(async () => {
    const [inserted] = await db
      .insert(botUsers)
      .values({
        name: `Invalid Telegram User ${stamp}`,
        email: `invalid-telegram-${stamp}@test.local`,
        password: "x",
        phoneNumber: "11900000000",
        adress: "Rua Teste, 1",
        pixCode: "chave-pix-teste",
        telegramUserId: `999999999${stamp}`.slice(0, 15),
      })
      .$returningId();
    userId = inserted.id;
  });

  afterAll(async () => {
    await db.delete(botUsers).where(eq(botUsers.id, userId));
  });

  it("botUsers (listagem) não lança e devolve 'indisponível' no lugar do username", async () => {
    const result = await UsersService.botUsers("all", { name: `Invalid Telegram User ${stamp}`, page: 1, limit: 10 });

    expect(result.data).toHaveLength(1);
    expect(result.data[0].telegram).toBe("indisponível");
  });

  it("botUser (detalhe) não lança e devolve 'indisponível' no lugar do username", async () => {
    const result = await UsersService.botUser(userId.toString());

    expect(result.telegram).toBe("indisponível");
  });
});

/**
 * Regressão: `updateUser`/`updatePass` tomavam `id`/`userId` do corpo da
 * requisição sem checar posse — qualquer staff autenticado conseguia editar
 * o perfil ou trocar a senha de qualquer outro staff. A correção remove o
 * campo do DTO por completo e faz o service exigir o id como parâmetro
 * explícito (sempre `req.user!.id` na rota) — este teste garante que o
 * service só altera a linha do `id` passado, nunca outra.
 */
describe("UsersService.updateUser / updatePass (posse por id explícito, banco real)", () => {
  const stamp = Date.now();
  let userAId: number;
  let userBId: number;

  beforeAll(async () => {
    const [userA] = await db
      .insert(staffUsers)
      .values({
        name: "Staff A",
        surname: `Ownership Test ${stamp}`,
        email: `staff-a-${stamp}@test.local`,
        password: await hashPassword("senha-original-a"),
      })
      .$returningId();
    userAId = userA.id;

    const [userB] = await db
      .insert(staffUsers)
      .values({
        name: "Staff B",
        surname: `Ownership Test ${stamp}`,
        email: `staff-b-${stamp}@test.local`,
        password: await hashPassword("senha-original-b"),
      })
      .$returningId();
    userBId = userB.id;
  });

  afterAll(async () => {
    // Por id capturado no `beforeAll`, não por um padrão na coluna
    // `surname` — o próprio teste renomeia o sobrenome de "Staff A" durante
    // `updateUser`, então um `LIKE` em cima dela deixa de casar com a linha
    // depois do teste rodar e o registro nunca é limpo (bug real encontrado
    // ao auditar o banco de dev antes desta migration: 3 linhas de teste
    // haviam vazado por exatamente esse motivo).
    await db.delete(staffUsers).where(inArray(staffUsers.id, [userAId, userBId]));
  });

  it("updateUser(id, patch) só altera a linha do id passado", async () => {
    await UsersService.updateUser(userAId, { name: "Staff A Renomeado", surname: "Novo Sobrenome", email: `staff-a-${stamp}@test.local` });

    const [rowA] = await db.select({ name: staffUsers.name }).from(staffUsers).where(eq(staffUsers.id, userAId));
    const [rowB] = await db.select({ name: staffUsers.name }).from(staffUsers).where(eq(staffUsers.id, userBId));

    expect(rowA.name).toBe("Staff A Renomeado");
    expect(rowB.name).toBe("Staff B");
  });

  it("updatePass(id, data) só altera a senha da linha do id passado", async () => {
    await UsersService.updatePass(userAId, { currentPassword: "senha-original-a", newPassword: "senha-nova-a-12345678" });

    await expect(
      UsersService.updatePass(userBId, { currentPassword: "senha-nova-a-12345678", newPassword: "outra-senha-12345678" }),
    ).rejects.toThrow("A senha atual inserida não corresponde à senha da conta em questão.");
  });
});
