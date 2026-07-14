# 🤖 Smart Option — Backend (API + Bot Telegram)

![Node.js](https://img.shields.io/badge/Node.js-24.x-green?style=for-the-badge&logo=node.js&logoColor=white) ![TypeScript](https://img.shields.io/badge/TypeScript-5.9-%23007ACC.svg?style=for-the-badge&logo=typescript&logoColor=white) ![Express.js](https://img.shields.io/badge/Express.js-4.x-%23404d59.svg?style=for-the-badge&logo=express&logoColor=white) ![Telegram](https://img.shields.io/badge/Telegram-Bot-2CA5E0?style=for-the-badge&logo=telegram&logoColor=white) ![Asaas](https://img.shields.io/badge/Asaas-PIX%20Gateway-00D084?style=for-the-badge) ![Drizzle](https://img.shields.io/badge/Drizzle-ORM-C5F74F?style=for-the-badge) ![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?style=for-the-badge&logo=docker&logoColor=white)

<p align="center">
  <a href="#sobre">Sobre</a> •
  <a href="#arquitetura">Arquitetura</a> •
  <a href="#funcionalidades">Funcionalidades</a> •
  <a href="#stack">Stack</a> •
  <a href="#estrutura">Estrutura</a> •
  <a href="#rotas">Rotas</a> •
  <a href="#comecando">Começando</a> •
  <a href="#ambientes">Configuração de Ambientes</a> •
  <a href="#emails">E-mails</a> •
  <a href="#cloudflare-tunnel">Cloudflare Tunnel</a> •
  <a href="#testes">Testes</a> •
  <a href="#deploy">Deploy</a> •
  <a href="#seguranca">Segurança</a> •
  <a href="#troubleshooting">Troubleshooting</a>
</p>

> ⚠️ **Aviso**: ambiente de demonstração/desenvolvimento. Não use credenciais reais de produção (Asaas, Resend/SMTP, bot Telegram) fora de um deploy controlado.

<h2 id="sobre">📌 Sobre</h2>

**Smart Option** é uma plataforma de investimento automatizado operada inteiramente via **bot do Telegram**, com um **painel administrativo** (repositório à parte) consumindo esta API. Usuários se cadastram, depositam via **PIX** (gateway **Asaas**), aderem a planos de rendimento mensal, indicam afiliados (rede de até 3 níveis com comissão) e solicitam saques — tudo dentro da conversa do Telegram.

Este repositório contém o **backend em Node.js/TypeScript**: a API REST do painel admin e o bot do Telegram, sobre uma base de dados MySQL (via **Drizzle ORM**) e Redis (cache, sessão do bot e filas **BullMQ**).

<h2 id="arquitetura">🏗️ Arquitetura</h2>

Camadas principais (Clean Architecture, de fora para dentro):

```
config/          → env validado com zod, fail-fast no boot
shared/          → erros, resposta HTTP padrão, logger (pino), segurança, validação
infrastructure/  → banco (Drizzle), cache (Redis), filas (BullMQ), HTTP (middlewares/segurança/OpenAPI)
interfaces/      → DTOs (zod) e rotas HTTP que não pertencem ao painel legado
payments/        → módulo financeiro: PaymentProvider (interface) + AsaasProvider (implementação única)
notifications/   → módulo de e-mail: EmailProvider (interface) + ResendProvider/SmtpProvider, selecionado por EMAIL_TYPE
wallet/          → WalletService — único ponto de mutação de saldo (ledger append-only, idempotente)
services/        → regras de negócio do painel admin e do bot (Drizzle)
server/          → bootstrap do Express, rotas do painel admin, middlewares, cron
bot/             → dispatcher do Telegram, fluxos (sessão por usuário via Redis), views somente-leitura
```

Decisões estruturais centrais:
- **`WalletService` é o único caminho permitido para alterar saldo.** Todo crédito/débito é uma linha em `wallet_transactions` (nunca um `UPDATE` solto), dentro de uma transação com `SELECT ... FOR UPDATE` e `idempotencyKey` obrigatória — reprocessar o mesmo evento nunca duplica.
- **`payments/` isola completamente o gateway de pagamento.** O resto da aplicação só conhece a interface `PaymentProvider`; hoje a única implementação é `AsaasProvider`. Trocar de gateway no futuro não vaza para `wallet/`, `services/` ou `bot/`.
- **`notifications/` isola completamente o envio de e-mail**, no mesmo padrão de `payments/`. O resto da aplicação só conhece `notificationService` (interface `EmailProvider` por trás); a escolha entre `ResendProvider` (padrão, API HTTP) e `SmtpProvider` é feita por uma única variável de ambiente (`EMAIL_TYPE`), sem nenhum condicional espalhado pelo código — ver [seção E-mails](#emails).
- **Webhooks são assíncronos.** `POST /api/webhooks/asaas` só valida a assinatura (comparação constant-time) e enfileira (BullMQ) — o processamento de negócio roda no worker, com retry e deduplicação em duas camadas (fila + `UNIQUE` no banco).
- **Sessão do bot vive no Redis, por usuário do Telegram**, roteada por um único dispatcher persistente (`src/bot/index.ts`) — não existe estado global em variáveis de módulo em lugar nenhum do bot.

<h2 id="funcionalidades">✨ Funcionalidades</h2>

### 🤖 Bot do Telegram
- Cadastro (nome, e-mail, senha, telefone, **CPF** validado por dígito verificador, endereço, chave PIX) com verificação de e-mail.
- Login com sessão isolada por usuário (Redis) — múltiplas conversas simultâneas nunca se cruzam.
- **Depósito e adesão de plano via PIX** (Asaas): QR Code + copia-e-cola, confirmação automática por webhook.
- **Saque via PIX**: fila de aprovação humana no painel antes do envio real à Asaas.
- **Transferência interna** entre usuários (por e-mail), débito/crédito atômico.
- **Extrato** completo e status de solicitações (depósito, saque, adesão).
- **Rede de afiliados (3 níveis)**: bônus de adesão/mensalidade e bônus de rentabilidade sobre a rede, com teto de 3 indicados por nível recebendo comissão.
- Rendimento diário automático (cron) para usuários com plano ativo.
- Suporte com escalonamento para atendimento humano.

### 🌐 API do painel administrativo
- Autenticação JWT com **refresh token rotativo** (reuso de token revogado derruba a família inteira — defesa contra roubo de token).
- Rate limiting (global + login, com store no Redis) e brute-force protection.
- CRUD e busca de usuários do bot, ajuste manual de saldo (auditado em `audit_logs`).
- Aprovação/rejeição de saques, listagem de solicitações (depósito/saque/adesão/suporte) com filtros.
- Dashboard com métricas do ledger real (`wallet_transactions`).
- Rede de afiliados por usuário.
- Documentação interativa em `GET /api/docs` (Swagger/OpenAPI).

<h2 id="stack">🛠️ Stack</h2>

| Camada | Tecnologia |
|---|---|
| Runtime | Node.js 24, TypeScript 5.9 |
| HTTP | Express 4, Helmet, CORS (allowlist), `express-rate-limit` (store Redis) |
| Banco | MySQL 8.4, [Drizzle ORM](https://orm.drizzle.team/) + `drizzle-kit` (migrations versionadas) |
| Cache / Filas / Sessão | Redis 7, [BullMQ](https://docs.bullmq.io/) |
| Pagamentos | [Asaas](https://docs.asaas.com/) (PIX — cobrança, transferência, webhook) |
| Bot | [`node-telegram-bot-api`](https://github.com/yagop/node-telegram-bot-api) |
| Auth | JWT (`jsonwebtoken`), `bcryptjs` |
| Validação | [Zod](https://zod.dev/) (DTOs HTTP + env) |
| Logging | [Pino](https://getpino.io/) estruturado, `pino-http`, `x-request-id` por requisição |
| Testes | [Vitest](https://vitest.dev/) + Supertest — testes de integração contra banco/Redis reais quando fizer sentido, não só mocks |
| Deploy | Docker multi-stage, Docker Compose, Nginx (reverse proxy + TLS) — ver [docs/deploy.md](docs/deploy.md) |
| Dev tunnel | [Cloudflare Tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/) (nomeado/persistente) — ver [seção Cloudflare Tunnel](#cloudflare-tunnel) |

<h2 id="estrutura">📁 Estrutura</h2>

```
src/
├─ config/env.ts                    # env validado (zod), fail-fast no boot
├─ shared/
│  ├─ errors/                       # AppError + subclasses (400/401/403/404/409/502)
│  ├─ http/response.ts              # envelope padrão { success, data } / { success:false, error }
│  ├─ logger/                       # pino
│  ├─ security/password.ts          # bcrypt + verificação/():  aceita SHA1 legado com lazy migration
│  └─ validation/cpf.ts             # validador de CPF (dígito verificador)
├─ infrastructure/
│  ├─ database/                     # cliente Drizzle, schema (18 tabelas), migrations, scripts (seed/backfill)
│  ├─ cache/redis.ts                # cliente ioredis único
│  ├─ queue/                        # BullMQ — fila e worker de webhooks da Asaas
│  └─ http/                         # segurança (helmet/cors/rate-limit), middlewares, OpenAPI, healthcheck
├─ interfaces/http/
│  ├─ dtos/                         # DTOs zod (auth, admin)
│  └─ routes/asaas-webhook.routes.ts
├─ payments/
│  ├─ interfaces/payment-provider.ts  # única porta que o resto da app importa
│  ├─ providers/asaas/                # customer, pix, transfer, webhook, notification + provider
│  └─ payment.service.ts              # fachada única (payment_transactions/payment_events/webhook_logs)
├─ wallet/wallet.service.ts          # único ponto de mutação de saldo (ledger + idempotência)
├─ services/                         # regras de negócio do painel admin (Drizzle)
│  └─ bot/                           # regras de negócio consumidas pelo bot (Drizzle)
├─ server/
│  ├─ index.ts                       # bootstrap do Express (trust proxy, segurança, cron)
│  ├─ cron.ts                        # rendimento diário, expiração de plano, taxa diamante
│  ├─ middlewares/auth.interceptor.ts
│  └─ routes/                        # rotas do painel admin (auth, users, dashboard, network, requests)
└─ bot/
   ├─ index.ts                       # dispatcher único e persistente (message/callback_query)
   ├─ session.service.ts             # sessão por usuário do Telegram, em Redis, TTL 30min
   ├─ flows/                         # auth, login, register, menu, deposit, withdrawal, transfer, products, support
   └─ views/                        # rede, link de afiliado, regras, extrato/solicitações (somente leitura)

cloudflared/
└─ config.yml                        # template do túnel (ver seção "Cloudflare Tunnel")

scripts/
├─ lib.sh / lib.ps1                  # funções compartilhadas (bash / PowerShell)
├─ start-dev.sh / start-dev.ps1      # "npm run dev:full"
├─ start-tunnel.sh / start-tunnel.ps1 # "npm run tunnel"
└─ run-platform.js                   # escolhe .sh (Linux/macOS) ou .ps1 (Windows) automaticamente
```

<h2 id="rotas">📍 Rotas da API</h2>

Todas as rotas (exceto `/health`, `/api/health`, `/api/auth`, `/email/verify`, `/api/webhooks/asaas`) exigem `Authorization: Bearer <accessToken>`.

### Health & Docs
| Método | Rota | Descrição |
|---|---|---|
| GET | `/health` | Liveness simples (status, uptime, versão, ambiente, timestamp) — não checa dependências; usado para validar o Cloudflare Tunnel |
| GET | `/api/health` | Readiness — status da aplicação, banco e Redis |
| GET | `/api/docs` | Documentação OpenAPI interativa |

### `/api/auth`
| Método | Rota | Descrição |
|---|---|---|
| POST | `/` | Login (rate limit dedicado: 10/15min por IP) |
| POST | `/refresh` | Rotaciona o refresh token |
| POST | `/logout` | Revoga o refresh token |
| POST | `/token` | Valida um access token (compatibilidade com o painel atual) |

### `/api/users`
| Método | Rota | Descrição |
|---|---|---|
| GET | `/` | Lista usuários do painel |
| PATCH | `/update-user` / `/update-pass` | Atualiza dados/senha do usuário do painel |
| GET | `/users-bot/:search` · POST `/users-bot` | Busca usuários do bot (termo livre ou filtros) |
| GET \| PATCH \| DELETE | `/user-bot/:id` \| `/user-bot` | Consulta, atualiza, exclui usuário do bot |
| POST | `/user-bot` | Cadastra usuário do bot (via painel) |
| PUT | `/user-bot/:id/:status` | Ativa/desativa usuário do bot |
| POST | `/transf-user-admin` | Ajuste manual de saldo (auditado) |

### `/api/dashboard`
| Método | Rota | Descrição |
|---|---|---|
| GET | `/users` | Métricas de usuários |
| GET | `/balance/:user_id/:product_id/:period` | Saldo/rendimento filtrado |
| GET | `/plans` | Lista de planos/produtos |

### `/api/network`
| Método | Rota | Descrição |
|---|---|---|
| POST | `/:id` | Rede de afiliados (indicados e patrocinadores) de um usuário |

### `/api/requests`
| Método | Rota | Descrição |
|---|---|---|
| GET \| POST | `/extract/:id` | Extrato do usuário (com filtros no POST) |
| POST | `/withdrawal/:id` \| `/deposit/:id` \| `/subscription/:id` \| `/support/:id` | Listagem filtrada de solicitações |
| POST | `/res-withdrawal` | Aprova/rejeita uma solicitação de saque (dispara transferência PIX na Asaas quando aprovado) |
| PATCH | `/was-read/:id/:status` | Marca solicitação de suporte como lida |
| GET | `/pendencies` | Contagem de pendências (saques + suporte) |

### Outras
| Método | Rota | Descrição |
|---|---|---|
| GET | `/email/verify/:token` | Página de confirmação de e-mail |
| POST | `/api/webhooks/asaas` | Webhook único da Asaas (pagamento + transferência) |

<h2 id="comecando">▶️ Começando (desenvolvimento local)</h2>

### Pré-requisitos
- Node.js 24+ (só necessário para rodar `npm run dev` fora do Docker; a API roda inteiramente containerizada com `npm run dev:full`)
- Docker + Docker Compose
- Token de bot do Telegram ([BotFather](https://t.me/BotFather)) — use um bot de teste dedicado, nunca o de produção
- Conta Asaas (Sandbox) — chave de API em <https://sandbox.asaas.com>
- Opcional, para receber webhooks reais localmente: [cloudflared](https://github.com/cloudflare/cloudflared) instalado e acesso à zona `example.url` no Cloudflare (ver [seção Cloudflare Tunnel](#cloudflare-tunnel))

### Passo a passo (tudo em Docker — recomendado)

```bash
git clone <url-do-repositorio>
cd smart-option
cp .env.development.example .env

# Configure o .env:
# SECRET_KEY e JWT_REFRESH_SECRET
# Windows (PowerShell): -join ((1..32 | % { '{0:x2}' -f (Get-Random -Min 0 -Max 256) }))
# Linux/macOS: openssl rand -hex 32
# Também configure: BOT_TOKEN, BOT_USER, ASAAS_API_KEY e e-mail (Resend/SMTP).
# Consulte "Configuração de Ambientes" para a lista completa.

npm run dev:full
```

Esse único comando sobe MySQL + Redis + a própria API em Docker (hot reload via bind mount — editar `src/**` reflete na hora, sem rebuild), aguarda tudo ficar saudável, configura o Cloudflare Tunnel automaticamente (se `cloudflared` estiver instalado e autenticado) e valida os endpoints `/health`/`/api/webhooks/asaas` publicamente. Ao final, imprime a URL pública pronta para cadastrar no painel Sandbox da Asaas.

Se preferir rodar sem o túnel (bot funciona normalmente por long polling; só depósito/assinatura/saque não confirmam sozinhos, por depender do webhook chegar): `npm run docker:up` sobe tudo, sem o Cloudflare Tunnel.

### Passo a passo (API fora do Docker, hot reload nativo do tsx)

```bash
git clone <url-do-repositorio>
cd smart-option
npm install

# Sobe só MySQL + Redis em Docker
npm run docker:up

cp .env.development.example .env
# mesmo preenchimento do passo acima

npm run db:migrate     # aplica o schema
npm run db:seed        # catálogo de produtos + usuário admin

npm run dev             # API + bot com hot reload (tsx watch), direto no host
```

A API sobe em `http://localhost:<APP_PORT>` (padrão `3000`). Para expor via túnel neste modo, rode `npm run tunnel` num segundo terminal.

### Scripts disponíveis

| Script | Descrição |
|---|---|
| `npm run dev` | API + bot, hot reload, direto no host (sem Docker) |
| `npm run dev:full` | Docker (API + MySQL + Redis) + Cloudflare Tunnel + validação, tudo orquestrado — ver [Cloudflare Tunnel](#cloudflare-tunnel) |
| `npm run docker:up` / `npm run docker:down` | Sobe/derruba API + MySQL + Redis em Docker |
| `npm run tunnel` | Só o Cloudflare Tunnel (API já rodando em outro terminal/container) |
| `npm run build` / `npm start` | Compila e roda a versão de produção |
| `npm test` / `npm run test:watch` / `npm run test:coverage` | Vitest |
| `npm run lint` / `npm run lint:fix` | ESLint |
| `npm run format` / `npm run format:check` | Prettier |
| `npm run db:generate` / `npm run db:migrate` / `npm run db:studio` | Drizzle Kit |
| `npm run db:seed` / `npm run db:backfill-wallets` | Scripts de dados |

<h2 id="ambientes">⚙️ Configuração de Ambientes</h2>

Duas variáveis de ambiente de exemplo, uma por ambiente — **nenhuma diferença de comportamento entre desenvolvimento e produção vem de código, só de `.env`**:

| Arquivo | Uso | Copiar para |
|---|---|---|
| [.env.development.example](.env.development.example) | Desenvolvimento local (Docker, Cloudflare Tunnel, Asaas Sandbox) | `.env` na sua máquina |
| [.env.production.example](.env.production.example) | Deploy (Asaas Produção, Nginx + TLS) | `.env` no ambiente de produção |

Ambos os arquivos cobrem **100% das variáveis que a aplicação lê** (validadas por `src/config/env.ts` com zod — o processo recusa subir, com mensagem clara, se faltar alguma obrigatória) e têm cada variável comentada com finalidade, valores esperados e exemplo. Nenhum valor fica hardcoded em nenhum lugar do código-fonte.

Variáveis sem valor padrão no schema são **obrigatórias**; as demais funcionam com o padrão indicado mesmo se deixadas em branco no `.env`. Resumo por categoria (detalhes e exemplos nos próprios arquivos `.env.*.example`):

| Categoria | Variáveis |
|---|---|
| Aplicação | `NODE_ENV`, `APP_PORT`, `API_BASE_PATH` |
| Banco de dados | `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_DATABASE` |
| Redis | `REDIS_URL` (+ `REDIS_PORT`, só usado pelo mapeamento de porta do `docker-compose.dev.yml`) |
| Autenticação/JWT | `SECRET_KEY`, `JWT_ACCESS_EXPIRES_IN`, `JWT_REFRESH_SECRET`, `JWT_REFRESH_EXPIRES_IN` |
| Telegram | `BOT_TOKEN`, `BOT_USER` |
| Logging | `LOG_LEVEL` |
| CORS / Rate limit | `CORS_ALLOWED_ORIGINS`, `RATE_LIMIT_WINDOW_MS`, `RATE_LIMIT_MAX` |
| Asaas | `ASAAS_ENV`, `ASAAS_API_KEY`, `ASAAS_BASE_URL`, `ASAAS_WEBHOOK_TOKEN` |
| Cloudflare Tunnel (dev) | `CF_TUNNEL_ID`, `CF_TUNNEL_TOKEN`, `CF_TUNNEL_DOMAIN`, `CF_TUNNEL_HOST` |
| E-mail (ver [seção E-mails](#emails)) | `EMAIL_TYPE`, `RESEND_API_KEY`, `MAIL_FROM_NAME`, `MAIL_FROM_ADDRESS`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD` |

> ⚠️ Qualquer valor que comece com `$` (a `ASAAS_API_KEY` sempre começa com `$aact_...`) precisa ficar entre aspas simples no `.env` — ver [Troubleshooting](#troubleshooting).

<h2 id="emails">📧 E-mails</h2>

Todo envio de e-mail da aplicação passa por um único módulo desacoplado,
`src/notifications/`, seguindo o mesmo padrão de `payments/` (interface +
implementações + factory): nenhum controller, service ou fluxo do bot chama
Resend ou SMTP diretamente — todos usam `notificationService`
(`src/notifications/services/notification.service.ts`), que expõe um método
por tipo de e-mail (`sendEmailVerification`, `sendPasswordReset`,
`sendDepositConfirmed` etc.) e nunca conhece qual provedor está por trás.

```
src/notifications/
  interfaces/    → EmailProvider (porta de saída) — EmailMessage, EmailSendResult
  providers/
    resend/      → ResendProvider — chama a API HTTP oficial do Resend (POST /emails)
    smtp/        → SmtpProvider — nodemailer, TLS, timeout e retry com backoff
    shared/      → retry compartilhado pelos dois providers
  templates/     → um arquivo por tipo de e-mail, todos reaproveitando o mesmo layout de marca
  factory/       → email.factory.ts: getEmailProvider() escolhe a implementação por EMAIL_TYPE
  services/      → notification.service.ts: fachada única consumida pelo resto da aplicação
```

### Como funciona o Resend (padrão)

Com `EMAIL_TYPE=resend` (o padrão se a variável não for definida), o
`ResendProvider` chama a API HTTP oficial do Resend — **nunca** SMTP. O
remetente é montado automaticamente a partir de `MAIL_FROM_NAME` +
`MAIL_FROM_ADDRESS`:

```
MAIL_FROM_NAME=Smart Option
MAIL_FROM_ADDRESS=smart-option@example.url
```
resulta em `From: Smart Option <smart-option@example.url>`. Requer
`RESEND_API_KEY`, `MAIL_FROM_NAME` e `MAIL_FROM_ADDRESS` — o boot falha com
mensagem clara se alguma faltar.

### Como funciona o SMTP (alternativa)

Com `EMAIL_TYPE=smtp`, o `SmtpProvider` assume, com TLS implícito na porta
465, timeout de conexão/socket (10s) e retry com backoff exponencial em caso
de falha transitória. Requer `SMTP_HOST`, `SMTP_USER` e `SMTP_PASSWORD`
(`SMTP_PORT` tem default `465`).

### Como trocar de provider

Só a variável de ambiente — nenhuma linha de código:

```
EMAIL_TYPE=resend   # ou
EMAIL_TYPE=smtp
```

A seleção acontece em um único lugar (`email.factory.ts`); não existe
condicional de provider em nenhum outro arquivo.

### Como adicionar um novo provider (ex.: Amazon SES, Mailgun, Brevo, SendGrid)

1. Criar `src/notifications/providers/<nome>/<nome>.provider.ts` implementando
   a interface `EmailProvider` (`src/notifications/interfaces/email.provider.ts`).
2. Adicionar as variáveis de ambiente necessárias em `src/config/env.ts`
   (schema + validação condicional, mesmo padrão de `RESEND_API_KEY`/`SMTP_*`).
3. Registrar o novo valor em `EMAIL_TYPE` (`z.enum([...])`) e o `if`/`switch`
   correspondente em `email.factory.ts`.

Nenhum outro arquivo da aplicação precisa mudar — todos dependem só da
interface `EmailProvider`, via `notificationService`.

<h2 id="cloudflare-tunnel">☁️ Cloudflare Tunnel</h2>

Em desenvolvimento local, a Asaas precisa alcançar `POST /api/webhooks/asaas` publicamente para confirmar depósitos/assinaturas/saques automaticamente. Este projeto usa o **Cloudflare Tunnel**, nomeado e persistente (nunca o modo `--url` efêmero), sob um subdomínio fixo de `example.url` — sem URLs temporárias que mudam a cada execução.

### 1. Instalação

| Sistema | Comando |
|---|---|
| Windows (Chocolatey) | `choco install cloudflared` |
| Windows (Scoop) | `scoop install cloudflared` |
| macOS (Homebrew) | `brew install cloudflared` |
| Linux (deb/rpm/binário) | <https://pkg.cloudflare.com/index.html> |
| Qualquer sistema | <https://github.com/cloudflare/cloudflared/releases> |

`npm run tunnel`/`npm run dev:full` detectam automaticamente se o `cloudflared` não está instalado e imprimem estas mesmas instruções.

### 2. Autenticação

```bash
cloudflared tunnel login
```

Abre o navegador — faça login na conta Cloudflare dona da zona `example.url` e autorize. Isso grava `~/.cloudflared/cert.pem` (uma vez por máquina; não é algo que os scripts deste projeto possam automatizar, por ser um fluxo interativo de navegador).

### 3. Criação do túnel (automática)

Com `cloudflared` instalado e autenticado, rode `npm run tunnel` ou `npm run dev:full`. Na primeira execução (quando `.env` não tem `CF_TUNNEL_ID` preenchido), o script:

1. Cria um túnel nomeado (`cloudflared tunnel create smart-option-dev`).
2. Grava as credenciais em `cloudflared/credentials/<id>.json` (gitignored).
3. Escreve o `CF_TUNNEL_ID` gerado de volta no seu `.env` — execuções seguintes reaproveitam o mesmo túnel.
4. Cria o registro DNS (`cloudflared tunnel route dns smart-option-dev example.url`).

Se preferir fazer manualmente:

```bash
cloudflared tunnel create smart-option-dev
cloudflared tunnel route dns smart-option-dev example.url
# copie o ID impresso para CF_TUNNEL_ID no .env
```

### 4. Configuração DNS

O passo 3 (`tunnel route dns`) já cria o registro CNAME automaticamente na zona `example.url`, apontando `example.url` para o túnel. Para conferir manualmente: painel Cloudflare → `example.url` → DNS → deve existir um CNAME `example` → `<CF_TUNNEL_ID>.cfargotunnel.com`, proxied (ícone laranja).

### 5. `cloudflared/config.yml`

[cloudflared/config.yml](cloudflared/config.yml) é um **template**, não lido diretamente pelo `cloudflared`. Os scripts (`scripts/lib.sh`/`scripts/lib.ps1`) substituem `{{CF_TUNNEL_ID}}`, `{{CF_TUNNEL_DOMAIN}}`, `{{CF_TUNNEL_HOST}}` e `{{APP_PORT}}` a partir do `.env` a cada execução, gerando `cloudflared/config.runtime.yml` (gitignored — contém o ID real do túnel). Isso mantém o `.env` como única fonte de verdade em vez de duplicar porta/domínio no YAML.

### 6. Uso em desenvolvimento

```bash
npm run dev:full
```

```
========================================

Smart Option API

Running:

http://localhost:3000

Cloudflare Tunnel:

https://example.url

Webhook URL:

https://example.url/api/webhooks/asaas

========================================
```

Cadastre a "Webhook URL" impressa no painel **Sandbox** da Asaas (Integrações → Webhooks). Ctrl+C encerra a API e o túnel; o Docker (MySQL/Redis) continua rodando — `npm run docker:down` quando terminar de fato.

### 7. Uso em produção

**O Cloudflare Tunnel é exclusivo de desenvolvimento.** Em produção, o tráfego público chega via Nginx + TLS (Let's Encrypt). `CF_TUNNEL_DOMAIN=api.example.url` existe no `.env.production.example` só para manter o schema de variáveis idêntico entre ambientes; nenhum `cloudflared` roda em produção. A única diferença de fato entre dev e produção é o conjunto de variáveis de ambiente (ver [Configuração de Ambientes](#ambientes)) — nenhum código muda entre os dois.

### 8. Integração com Docker

`npm run dev:full` sobe a API **dentro** do Docker (`docker-compose.dev.yml`, serviço `app`, hot reload via bind mount de `src/`) e roda o `cloudflared` **no host**, apontando para a porta publicada pelo container (`CF_TUNNEL_HOST=localhost`, mesma porta de `APP_PORT`). Não há necessidade de colocar o `cloudflared` dentro de um container.

### 9. Integração com a Asaas

Com o túnel no ar, cadastre a Webhook URL no painel **Sandbox** da Asaas (Integrações → Webhooks → Nova). No campo de token/chave de acesso, cole o mesmo valor de `ASAAS_WEBHOOK_TOKEN` do seu `.env` — é o que a rota valida em cada requisição recebida (comparação constant-time, `src/payments/providers/asaas/webhook.service.ts`). Dispare um evento de teste pelo próprio painel e acompanhe o log do terminal (prefixo `app-1` no `docker compose logs`) — a entrega deve aparecer processada pelo worker de webhooks.

<h2 id="testes">🧪 Testes</h2>

```bash
npm test
```

A suíte combina testes de lógica pura (sem I/O) com testes de **integração contra o MySQL/Redis reais** do `docker-compose.dev.yml` (obrigatório estar de pé para rodar a suíte inteira) — em especial para o `WalletService`, autenticação/rotação de refresh token e o motor de comissões da rede de afiliados, onde um mock esconderia justamente as garantias que mais importam (transação, lock de linha, idempotência). Os arquivos rodam em sequência (`fileParallelism: false`) para evitar deadlock real de banco quando múltiplos testes de integração tocam as mesmas tabelas.

<h2 id="deploy">🚀 Deploy</h2>

Este guia cobre o deploy de produção do Smart Option Backend (API + Bot Telegram) numa VPS Linux usando `docker-compose.prod.yml`. Pressupõe uma VPS Ubuntu/Debian limpa, acesso root/sudo, e um domínio já apontando para o IP da VPS (registro A).

### 1. Pré-requisitos na VPS

```bash
# Docker Engine + Compose plugin
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
# faça logout/login para o grupo docker valer para o seu usuário

docker --version
docker compose version
```

Abra as portas 80 e 443 no firewall (ex.: `ufw allow 80,443/tcp`). Nenhuma outra porta precisa ficar exposta publicamente — MySQL, Redis e a própria API só são alcançáveis pela rede interna do Docker Compose (`internal`), nunca diretamente da internet.

### 2. Clonar e configurar

```bash
git clone <url-do-repositorio> smart-option
cd smart-option

cp .env.production.example .env
chmod 600 .env
```

Edite `.env` com os valores reais de produção (a referência completa de cada variável está nos comentários do próprio `.env.production.example`). Pontos que exigem atenção:

- `NODE_ENV=production`
- `SECRET_KEY` e `JWT_REFRESH_SECRET`: gere dois valores aleatórios **diferentes entre si** — `openssl rand -hex 32`.
- `DB_PASSWORD`: senha forte, não a de desenvolvimento.
- `BOT_TOKEN`/`BOT_USER`: token real do bot em produção (BotFather).
- `ASAAS_API_KEY`/`ASAAS_BASE_URL`: chave e URL de **produção** da Asaas (`https://api.asaas.com/v3`), não sandbox.
- `ASAAS_WEBHOOK_TOKEN`: mesmo valor cadastrado no painel da Asaas ao configurar o webhook.
- `CORS_ALLOWED_ORIGINS`: domínio real do painel admin, não `localhost`.
- `SMTP_*`: credenciais reais de envio de e-mail.
- **Qualquer valor que comece com `$`** (a `ASAAS_API_KEY` de produção sempre começa com `$aact_prod_...`) **precisa ficar entre aspas simples** no `.env` (`ASAAS_API_KEY='$aact_prod_...'`) — sem isso o Docker Compose tenta interpolar o `$` como referência a outra variável e o valor vira string vazia silenciosamente. Ver "Troubleshooting" no README.
- **Não defina `DB_HOST`/`REDIS_URL` manualmente** — `docker-compose.prod.yml` já sobrescreve essas duas variáveis para apontar para os serviços `mysql`/`redis` da rede interna, então o que estiver em `.env` para elas é ignorado nesse ambiente.
- O `.env` não é copiado para dentro da imagem — `docker-compose.prod.yml` monta o arquivo diretamente no container (`./.env:/app/.env:ro`) e a aplicação o lê como sempre (via `dotenv`). Garanta que o arquivo exista na raiz do projeto na VPS antes de subir os serviços `app`/`migrate`.

Edite `nginx/nginx.conf` e troque `example.com` pelo domínio real (aparece 2 vezes: no bloco HTTP de redirecionamento e no bloco HTTPS, incluindo os dois caminhos `ssl_certificate*`).

### 3. Subir banco e cache

```bash
docker compose -f docker-compose.prod.yml up -d mysql redis
docker compose -f docker-compose.prod.yml ps
# aguarde os dois aparecerem como "healthy"
```

### 4. Rodar as migrations

```bash
docker compose -f docker-compose.prod.yml --profile tools run --rm migrate
```

Isso constrói a imagem a partir do estágio `builder` do `Dockerfile` (que ainda tem `drizzle-kit` e as migrations) e aplica o schema completo. Rode o seed **apenas no primeiro deploy** (recria o catálogo de produtos com os IDs 1-6 esperados pelo restante do sistema):

```bash
docker compose -f docker-compose.prod.yml --profile tools run --rm migrate npm run db:seed
```

### 5. Emitir o certificado TLS (primeiro deploy)

O `nginx.conf` final espera um certificado que ainda não existe — subir com ele direto faz o Nginx falhar ao iniciar. Por isso o primeiro boot usa uma config HTTP-only (`nginx/nginx.bootstrap.conf`) só para responder ao desafio ACME do certbot.

```bash
# 1. Aponte o volume do serviço nginx para a config de bootstrap:
#    edite docker-compose.prod.yml, na seção "nginx" > "volumes", troque
#    temporariamente "./nginx/nginx.conf:..." por "./nginx/nginx.bootstrap.conf:/etc/nginx/nginx.conf:ro"

docker compose -f docker-compose.prod.yml up -d app nginx

# 2. Emita o certificado (troque o domínio e o e-mail):
docker compose -f docker-compose.prod.yml --profile tools run --rm certbot \
  certonly --webroot -w /var/www/certbot \
  -d example.com --email voce@example.com --agree-tos --no-eff-email

# 3. Reverta o volume do nginx para "./nginx/nginx.conf:..." (a config com HTTPS)
#    e recarregue:
docker compose -f docker-compose.prod.yml up -d --force-recreate nginx
```

### Renovação

Certificados Let's Encrypt expiram em 90 dias. Adicione ao crontab do host (`crontab -e`):

```
0 3 * * 1 cd /caminho/para/smart-option && docker compose -f docker-compose.prod.yml --profile tools run --rm certbot renew --webroot -w /var/www/certbot && docker compose -f docker-compose.prod.yml exec nginx nginx -s reload
```

## 6. Subir a aplicação

```bash
docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml ps
```

Confirme:

```bash
curl -s https://SEU_DOMINIO/api/health | head -c 300
```

Deve responder `{"success":true,"data":{"status":"ok",...}}`. O bot deve aparecer online no Telegram em seguida (confira `docker compose -f docker-compose.prod.yml logs -f app`, procure por "Bot Telegram iniciado" e ausência de erros de polling).

### 7. Operação do dia a dia

- **Logs**: `docker compose -f docker-compose.prod.yml logs -f app`
- **Atualizar para uma nova versão**: `git pull`, depois `docker compose -f docker-compose.prod.yml up -d --build app` (o Nginx e o banco não precisam reiniciar). Se a mudança incluiu uma migration nova, rode o passo 4 novamente antes de subir a `app` nova.
- **Encerramento gracioso**: `docker compose -f docker-compose.prod.yml stop app` envia `SIGTERM` — o processo fecha o servidor HTTP, para o polling do bot, encerra o worker de webhooks e fecha as duas pools de conexão MySQL antes de sair (ver `src/index.ts`). Evite `kill -9`/`docker kill` em uso normal, pois pula esse desligamento.
- **Backup do banco**: o volume nomeado `smart_option_mysql_data` contém todos os dados. Backup lógico recorrente recomendado: `docker compose -f docker-compose.prod.yml exec mysql mysqldump -u root -p"$DB_PASSWORD" "$DB_DATABASE" | gzip > backup-$(date +%F).sql.gz`, agendado fora do container (cron do host) e copiado para armazenamento externo à VPS.
- **Escala vertical do worker de webhooks**: hoje roda no mesmo processo da API (`src/index.ts`, `startAsaasWebhookWorker()`) — adequado até o volume atual; separar em container próprio é uma decisão de infra a revisitar se o volume de webhooks crescer.

### 8. O que este setup deliberadamente não cobre

- **Múltiplas réplicas do container `app`**: o bot Telegram usa long polling (`getUpdates`), que só pode ter **um** consumidor ativo por token — rodar 2 réplicas da `app` faz a segunda derrubar a primeira com erro 409 (o mesmo observado durante a verificação manual da Fase 7). Escalar horizontalmente exigiria separar o bot da API em processos/serviços distintos e trocar o bot para webhook do Telegram em vez de polling — fora do escopo desta fase.
- **CI/CD automatizado**: o passo 6 é manual de propósito; pipeline de deploy automático fica para quando houver ambiente de staging.

<h2 id="seguranca">🔒 Segurança</h2>

- 100% das queries de negócio via Drizzle (parametrizado) — sem SQL cru concatenado por string em nenhum caminho alcançável por entrada externa.
- Senhas com bcrypt (custo 12); hashes SHA1 legados são aceitos no login e migrados automaticamente na hora (lazy migration).
- JWT de acesso de curta duração + refresh token rotativo com detecção de reuso (família inteira revogada em caso de suspeita de roubo).
- Rate limiting global e dedicado ao login, com store no Redis (efetivo mesmo com múltiplas réplicas).
- Assinatura de webhook validada com comparação constant-time.
- Helmet, CORS por allowlist, `trust proxy` restrito a 1 hop em produção (só o Nginx do próprio compose).
- Nenhuma porta de banco/cache é exposta publicamente no deploy de produção — só o Nginx (80/443).
- Segredos apenas via variáveis de ambiente (nunca hardcoded) — ver [.env.development.example](.env.development.example) / [.env.production.example](.env.production.example).

<h2 id="troubleshooting">🛠️ Troubleshooting</h2>

**"O cloudflared não foi encontrado no PATH"** — instale conforme a [seção Cloudflare Tunnel](#cloudflare-tunnel) e rode o comando de novo.

**"cloudflared instalado, mas você ainda não autenticou esta máquina"** — rode `cloudflared tunnel login` (abre o navegador; escolha a zona `example.url`).

**Um valor do `.env` "desaparece" dentro do Docker (ex.: chamadas à Asaas falham com "chave inválida" mesmo com `ASAAS_API_KEY` preenchida)** — o Docker Compose interpola `${...}` (e qualquer `$` solto) também dentro de valores carregados de arquivos `.env`, não só na própria `docker-compose.yml`. Uma chave de API da Asaas de verdade (formato `$aact_...`) vira string vazia silenciosamente se não estiver entre aspas simples. Corrija no `.env`:
```
ASAAS_API_KEY='$aact_hmlg_...'
```
(Este projeto já monta o `.env` como arquivo dentro do container em vez de injetar via `env_file:` do Compose, exatamente para evitar essa classe de bug — mas o mesmo cuidado de aspas vale para qualquer variável nova que você adicionar e que comece com `$`.)

**MySQL/Redis não ficam "healthy"** — confira `docker compose -f docker-compose.dev.yml logs mysql redis`. Se for a primeira subida, pode levar alguns segundos a mais (inicialização do MySQL).

**Porta já em uso (`EADDRINUSE`)** — outra instância da API (Docker ou `npm run dev` no host) já está usando a porta de `APP_PORT`. `npm run dev:full` detecta uma API já respondendo em `/health` e reaproveita em vez de duplicar; se o erro persistir, pare o processo/container antigo primeiro (`npm run docker:down` ou feche o outro terminal).

**Erro 409 do Telegram ("terminated by other getUpdates request")** — o bot usa long polling, que só permite **um** consumidor por token. Confirme que não há outra instância (dev + produção, ou dois terminais) usando o mesmo `BOT_TOKEN` ao mesmo tempo.

**Registro DNS do túnel não aparece** — confirme que a conta autenticada (`cloudflared tunnel login`) realmente tem a zona `example.url`. Sem isso, `cloudflared tunnel route dns` falha silenciosamente na criação do CNAME — crie manualmente pelo painel Cloudflare se necessário.

<h2 id="related-projects">🔗 Projetos relacionados</h2>

👑 Painel Admin (frontend) — [repositório](https://github.com/issagomesdev/smart-option-admin)
