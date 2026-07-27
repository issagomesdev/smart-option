/**
 * Especificação OpenAPI 3.0, escrita à mão. Cobre as rotas reescritas até a
 * Fase 6 (health, auth, webhook Asaas) — cada fase seguinte que reescrever
 * um grupo de rotas soma sua documentação aqui, em vez de tentar documentar
 * de uma vez rotas que ainda vão mudar de forma nas próximas fases.
 */
export const openApiDocument = {
  openapi: "3.0.3",
  info: {
    title: "Smart Option — API",
    version: "1.0.0",
    description: "API do backend Smart Option (painel admin + integração de pagamentos Asaas).",
  },
  servers: [{ url: "/api" }],
  components: {
    securitySchemes: {
      bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
    },
    schemas: {
      SuccessEnvelope: {
        type: "object",
        properties: { success: { type: "boolean", example: true }, data: { type: "object" } },
      },
      PlanInput: {
        type: "object",
        required: ["name", "description", "price", "earningsMonthly", "purchaseType"],
        properties: {
          name: { type: "string", maxLength: 255 },
          description: { type: "string", description: "Texto exibido ao usuário no bot." },
          price: { type: "number", minimum: 0, example: 297 },
          earningsMonthly: {
            type: "number",
            minimum: 0,
            maximum: 999.99,
            description: "Percentual ao mês (ex.: 8 = 8%). Alimenta o rendimento diário real.",
            example: 8,
          },
          purchaseType: {
            type: "string",
            enum: ["auto", "manual"],
            description:
              "`auto`: cobrança PIX imediata pela Asaas. `manual`: não cobra — abre uma solicitação de atendimento (`requests`, tipo `service`) para a equipe tratar pelo painel.",
          },
          isActive: { type: "boolean", default: true, description: "Plano fora de circulação continua existindo, mas não é ofertado." },
        },
      },
      ErrorEnvelope: {
        type: "object",
        properties: {
          success: { type: "boolean", example: false },
          error: {
            type: "object",
            properties: { code: { type: "string" }, message: { type: "string" }, details: { type: "object" } },
          },
          requestId: { type: "string" },
        },
      },
    },
  },
  paths: {
    "/health": {
      get: {
        summary: "Healthcheck da API",
        tags: ["Infra"],
        description:
          "Além do status das dependências, devolve `demo: boolean` (`APP_DEMO`). É público de propósito: a tela de login do painel é anônima e precisa saber se deve oferecer o botão \"Entrar como visitante\".",
        responses: {
          "200": { description: "Banco de dados e Redis disponíveis" },
          "503": { description: "Uma ou mais dependências indisponíveis" },
        },
      },
    },
    "/auth": {
      post: {
        summary: "Login do painel admin",
        tags: ["Auth"],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["email", "password"],
                properties: {
                  email: { type: "string", format: "email" },
                  password: { type: "string" },
                  remember: { type: "boolean", default: false },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Login efetuado — retorna accessToken (curta duração) e refreshToken (usado em /auth/refresh)",
          },
          "400": { description: "Corpo da requisição inválido", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorEnvelope" } } } },
          "401": { description: "Credenciais inválidas", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorEnvelope" } } } },
          "429": { description: "Muitas tentativas — limite de 10 requisições por 15 minutos por IP" },
        },
      },
    },
    "/auth/demo-login": {
      post: {
        summary: "Login de visitante (modo demonstração)",
        tags: ["Auth"],
        description:
          "Cria uma sessão autenticada sem e-mail nem senha, para a demonstração pública. Só existe quando `APP_DEMO=true` — caso contrário responde 404 (e não 403, para não confirmar a existência do recurso). Todos os visitantes compartilham a mesma conta (`visitante@demo.local`), que recebe o papel `admin`: a contenção não vem de permissões reduzidas, e sim do bloqueio das ações irreversíveis (ver 403 nas rotas marcadas).",
        responses: {
          "200": { description: "Sessão criada — mesmo formato de `POST /auth` (accessToken + refreshToken + user)" },
          "404": { description: "Modo demonstração desligado (`APP_DEMO=false`) — a rota não existe" },
          "429": { description: "Muitas tentativas — limite de 60 requisições por 15 minutos por IP" },
        },
      },
    },
    "/auth/refresh": {
      post: {
        summary: "Rotaciona o refresh token e emite um novo access token",
        tags: ["Auth"],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { type: "object", required: ["refreshToken"], properties: { refreshToken: { type: "string" } } } } },
        },
        responses: {
          "200": { description: "Novo par accessToken/refreshToken. O token apresentado é revogado (rotação)." },
          "401": {
            description:
              "Refresh token inválido, expirado, ou já revogado (reuso de token revogado revoga toda a família de tokens do usuário)",
          },
        },
      },
    },
    "/auth/logout": {
      post: {
        summary: "Revoga um refresh token",
        tags: ["Auth"],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { type: "object", required: ["refreshToken"], properties: { refreshToken: { type: "string" } } } } },
        },
        responses: { "200": { description: "Token revogado (idempotente)" } },
      },
    },
    "/auth/token": {
      post: {
        summary: "Valida um access token (compatibilidade com o painel atual)",
        tags: ["Auth"],
        parameters: [{ name: "Authorization", in: "header", required: true, schema: { type: "string" }, example: "Bearer <accessToken>" }],
        responses: {
          "200": { description: "Token válido — retorna os dados do usuário autenticado" },
          "401": { description: "Token ausente, inválido ou expirado" },
        },
      },
    },
    "/webhooks/asaas": {
      post: {
        summary: "Webhook único da Asaas (eventos de pagamento e transferência)",
        tags: ["Webhooks"],
        parameters: [
          {
            name: "asaas-access-token",
            in: "header",
            required: true,
            schema: { type: "string" },
            description: "Token configurado no painel Asaas ao cadastrar o webhook — comparado com ASAAS_WEBHOOK_TOKEN.",
          },
        ],
        requestBody: { required: true, content: { "application/json": { schema: { type: "object" } } } },
        responses: {
          "200": {
            description:
              "Sempre responde rápido: só valida a assinatura e enfileira o processamento assíncrono (BullMQ). `data.duplicate` indica se o evento já havia sido recebido antes.",
          },
          "401": { description: "Header asaas-access-token ausente ou inválido" },
        },
      },
    },
    "/dashboard/summary": {
      get: {
        summary: "Agregador único do Dashboard (KPIs, gráfico, indicador do dia e movimentações recentes)",
        tags: ["Dashboard"],
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "period",
            in: "query",
            schema: { type: "string", enum: ["all", "today", "7d", "30d", "custom"], default: "today" },
            description: "'all' devolve o histórico completo (sem janela de comparação com período anterior).",
          },
          { name: "start", in: "query", schema: { type: "string", format: "date" }, description: "Obrigatório com period=custom (formato YYYY-MM-DD)." },
          { name: "end", in: "query", schema: { type: "string", format: "date" }, description: "Obrigatório com period=custom (formato YYYY-MM-DD)." },
          { name: "userId", in: "query", schema: { type: "integer" }, description: "Recorte opcional: restringe todos os números a um único usuário." },
          { name: "productId", in: "query", schema: { type: "integer" }, description: "Recorte opcional: restringe todos os números a um único plano." },
        ],
        responses: {
          "200": {
            description:
              "Os 4 KPIs com comparação ao período anterior (usuários ativos, saldo da rede, depósitos, saques pendentes), gráfico de rentabilidade da rede, indicador de aprovações do dia (sempre calendário-hoje, independente de `period`) e as 10 movimentações mais recentes. Cacheado por 45s (Redis), chave por combinação de filtros.",
          },
          "400": { description: "Filtro de período inválido", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorEnvelope" } } } },
          "401": { description: "Token ausente, inválido ou expirado" },
        },
      },
    },
    "/dashboard/plans": {
      get: {
        summary: "Lista os planos disponíveis",
        tags: ["Dashboard"],
        security: [{ bearerAuth: [] }],
        responses: {
          "200": { description: "Array de planos ({ id, name })" },
          "401": { description: "Token ausente, inválido ou expirado" },
        },
      },
    },
    "/plans": {
      get: {
        summary: "Lista o catálogo de planos (paginado, filtrável)",
        tags: ["Planos"],
        security: [{ bearerAuth: [] }],
        description: "Leitura aberta a qualquer staff autenticado, mesma convenção do dashboard e da auditoria.",
        parameters: [
          { name: "page", in: "query", schema: { type: "integer", default: 1 } },
          { name: "limit", in: "query", schema: { type: "integer", default: 20, maximum: 100 } },
          { name: "sortBy", in: "query", schema: { type: "string", enum: ["id", "name", "price", "earningsMonthly", "purchaseType"] } },
          { name: "sortDirection", in: "query", schema: { type: "string", enum: ["asc", "desc"] } },
          { name: "search", in: "query", schema: { type: "string" }, description: "Busca por nome ou descrição." },
          { name: "purchaseType", in: "query", schema: { type: "string", enum: ["auto", "manual"] } },
          { name: "isActive", in: "query", schema: { type: "string", enum: ["true", "false"] } },
        ],
        responses: {
          "200": {
            description:
              "Lista paginada. Cada plano traz `isSystem` (semeado, não excluível), `isActive` e `subscriberCount` (quantos usuários já o adquiriram — bloqueia exclusão).",
          },
          "401": { description: "Token ausente, inválido ou expirado" },
        },
      },
      post: {
        summary: "Cria um plano",
        tags: ["Planos"],
        security: [{ bearerAuth: [] }],
        description: "Exige a permissão `plans.manage`. Planos criados aqui nunca são de sistema (`isSystem` não vem do corpo).",
        requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/PlanInput" } } } },
        responses: {
          "201": { description: "Plano criado" },
          "400": { description: "Corpo inválido", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorEnvelope" } } } },
          "403": { description: "Sem a permissão `plans.manage`" },
        },
      },
    },
    "/plans/{id}": {
      get: {
        summary: "Detalhe de um plano",
        tags: ["Planos"],
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
        responses: {
          "200": { description: "Plano encontrado" },
          "404": { description: "Plano inexistente" },
        },
      },
      patch: {
        summary: "Edita um plano",
        tags: ["Planos"],
        security: [{ bearerAuth: [] }],
        description:
          "Exige `plans.manage`. **Atenção:** `earningsMonthly` alimenta o cálculo do rendimento diário (`applyEarningsDaily`), então editá-lo altera o valor creditado a todos os assinantes do plano a partir do próximo processamento.",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
        requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/PlanInput" } } } },
        responses: {
          "200": { description: "Plano atualizado" },
          "403": { description: "Sem a permissão `plans.manage`" },
          "404": { description: "Plano inexistente" },
        },
      },
      delete: {
        summary: "Exclui um plano",
        tags: ["Planos"],
        security: [{ bearerAuth: [] }],
        description:
          "Exige `plans.manage`. Recusa (409) para planos de sistema — os 6 semeados, cujos IDs a rotina de promoção de tier referencia diretamente — e para planos já adquiridos por algum usuário. Nesses casos, desative o plano (`isActive: false`) em vez de excluir.",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
        responses: {
          "200": { description: "Plano excluído" },
          "403": { description: "Sem a permissão `plans.manage`" },
          "404": { description: "Plano inexistente" },
          "409": {
            description: "Plano de sistema ou com assinantes — não pode ser excluído",
            content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorEnvelope" } } },
          },
        },
      },
    },
    "/audit": {
      post: {
        summary: "Auditoria Financeira — histórico completo e filtrável de movimentações",
        tags: ["Auditoria"],
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: false,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  page: { type: "integer", default: 1 },
                  limit: { type: "integer", default: 20, maximum: 100 },
                  sortBy: { type: "string", enum: ["createdAt", "amount", "userName"] },
                  sortDirection: { type: "string", enum: ["asc", "desc"], default: "desc" },
                  period: {
                    type: "string",
                    enum: ["today", "7d", "30d", "custom"],
                    description: "Omitido por padrão — sem `period`, nenhum filtro de data é aplicado (histórico completo).",
                  },
                  start: { type: "string", format: "date", description: "Obrigatório com period=custom." },
                  end: { type: "string", format: "date", description: "Obrigatório com period=custom." },
                  type: {
                    type: "string",
                    enum: [
                      "deposit",
                      "withdrawal",
                      "earnings",
                      "profitability",
                      "subscription",
                      "tuition",
                      "transfer_in",
                      "transfer_out",
                      "admin_adjustment",
                      "diamond_tax",
                    ],
                  },
                  status: {
                    type: "string",
                    enum: ["completed", "pending"],
                    description: "'completed' = ledger (wallet_transactions); 'pending' = saques/checkouts ainda em aberto.",
                  },
                  userId: { type: "integer" },
                  minValue: { type: "number" },
                  maxValue: { type: "number" },
                  search: { type: "string", description: "Busca por nome de usuário, referência ou ID da operação." },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description:
              "Lista paginada unindo o ledger (sempre concluído) com saques/checkouts ainda em aberto — nunca cacheado, sempre reflete o estado real. Cada linha traz tipo, usuário, Telegram ID, valor, status, origem/gateway, administrador responsável e observações.",
          },
          "400": { description: "Filtros inválidos", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorEnvelope" } } } },
          "401": { description: "Token ausente, inválido ou expirado" },
        },
      },
    },
  },
} as const;
