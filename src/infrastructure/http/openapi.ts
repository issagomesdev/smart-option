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
  },
} as const;
