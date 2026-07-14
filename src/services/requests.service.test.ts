import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../payments/payment.service", () => ({
  paymentService: { createWithdrawalTransfer: vi.fn() },
}));

import { eq } from "drizzle-orm";
import { afterAll, beforeAll } from "vitest";
import { db } from "../infrastructure/database/client";
import { botUsers, withdrawals } from "../infrastructure/database/schema";
import { paymentService } from "../payments/payment.service";
import { RequestService } from "./requests.service";

/**
 * Regressão para o bug corrigido na Fase 6: a rota `POST /res-withdrawal`
 * chamava `resWithdrawal(req.body.res)` — passava só o booleano, então
 * `body.id`/`body.observation` chegavam como `undefined` dentro do service e
 * a aprovação/rejeição de saque pelo painel nunca gravava o registro certo.
 * Este teste garante que `resWithdrawal` recebe e usa o corpo inteiro.
 */
describe("RequestService.resWithdrawal (integração, banco real)", () => {
  let userId: number;

  beforeAll(async () => {
    const stamp = Date.now();
    const [user] = await db
      .insert(botUsers)
      .values({
        name: "Withdrawal Approval Test",
        email: `res-withdrawal-${stamp}@test.local`,
        password: "x",
        phoneNumber: "11900000000",
        adress: "Rua Teste, 1",
        pixCode: "chave-pix-teste",
      })
      .$returningId();
    userId = user.id;
  });

  afterAll(async () => {
    await db.delete(withdrawals).where(eq(withdrawals.userId, userId));
    await db.delete(botUsers).where(eq(botUsers.id, userId));
  });

  beforeEach(() => {
    vi.mocked(paymentService.createWithdrawalTransfer).mockReset();
  });

  async function createWithdrawal(): Promise<number> {
    const [inserted] = await db
      .insert(withdrawals)
      .values({ userId, value: "150.00", referenceId: crypto.randomUUID() })
      .$returningId();
    return inserted.id;
  }

  it("res=false marca a solicitação como recusada, gravando a observação, sem chamar o gateway de pagamento", async () => {
    const withdrawalId = await createWithdrawal();

    const result = await RequestService.resWithdrawal({ res: false, id: withdrawalId, observation: "Dados bancários inválidos" });

    expect(result).toEqual({ status: true, message: "Solicitação respondida com sucesso!" });
    expect(paymentService.createWithdrawalTransfer).not.toHaveBeenCalled();

    const [row] = await db.select().from(withdrawals).where(eq(withdrawals.id, withdrawalId));
    expect(row.status).toBe("refused");
    expect(row.replyObservation).toBe("Dados bancários inválidos");
  });

  it("res=true aprova a solicitação, chama o gateway com o id correto e grava o transactionId retornado", async () => {
    const withdrawalId = await createWithdrawal();
    vi.mocked(paymentService.createWithdrawalTransfer).mockResolvedValue({ externalId: "transfer-ext-123" } as never);

    const result = await RequestService.resWithdrawal({ res: true, id: withdrawalId, observation: "Aprovado manualmente" });

    expect(result).toEqual({ status: true, message: "Solicitação respondida com sucesso!" });
    expect(paymentService.createWithdrawalTransfer).toHaveBeenCalledWith(
      { id: userId },
      expect.objectContaining({ userId, amount: 150, pixKey: "chave-pix-teste", legacyReferenceId: String(withdrawalId) }),
    );

    const [row] = await db.select().from(withdrawals).where(eq(withdrawals.id, withdrawalId));
    expect(row.status).toBe("authorized");
    expect(row.replyObservation).toBe("Aprovado manualmente");
    expect(row.transactionId).toBe("transfer-ext-123");
  });

  it("res=true com solicitação inexistente lança NotFoundError", async () => {
    await expect(RequestService.resWithdrawal({ res: true, id: 999999999 })).rejects.toThrow("Solicitação de saque não encontrada");
  });

  it("res=true com falha no gateway retorna status false em vez de lançar, e não altera o status da solicitação", async () => {
    const withdrawalId = await createWithdrawal();
    vi.mocked(paymentService.createWithdrawalTransfer).mockRejectedValue(new Error("Falha de rede"));

    const result = await RequestService.resWithdrawal({ res: true, id: withdrawalId });

    expect(result.status).toBe(false);

    const [row] = await db.select().from(withdrawals).where(eq(withdrawals.id, withdrawalId));
    expect(row.status).toBe("pending");
  });
});
