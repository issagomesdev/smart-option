<p align="center">
  <a href="./README.md">🇺🇸 English</a> |
  <b>🇧🇷 Português</b> |
  <a href="./README.es.md">🇪🇸 Español</a>
</p>

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
  <a href="#troubleshooting">Troubleshooting</a> •
  <a href="#licenca">Licença</a> •
  <a href="#related-projects">Projetos Relacionados</a>
</p>

> ⚠️ **Aviso**: ambiente de demonstração/desenvolvimento. Não use credenciais reais de produção (Asaas, Resend/SMTP, bot Telegram) fora de um deploy controlado.

<h2 id="sobre">📌 Sobre</h2>

**Smart Option** é uma plataforma de investimentos automatizados composta por dois projetos principais: um **bot do Telegram**, responsável pela experiência dos usuários, e um **painel administrativo**, mantido em repositório à parte, usado para gerenciamento, monitoramento e operação da plataforma. Pelo bot do Telegram, os usuários se cadastram, depositam via **PIX** com o **Asaas**, adquirem planos de rendimento mensal, constroem uma rede de afiliados com até **três níveis de comissão**, acompanham suas movimentações financeiras e solicitam saques — tudo sem sair da conversa.

Este repositório contém o **backend** da plataforma, escrito em **Node.js** e **TypeScript**, responsável tanto pela **API REST** consumida pelo painel administrativo quanto por toda a lógica de negócio do bot. A aplicação usa **MySQL** com **Drizzle ORM** para persistência, **Redis** para cache, sessões do bot e processamento assíncrono com **BullMQ** — uma arquitetura moderna, escalável e pronta para produção.

<h2 id="arquitetura">🏗️ Arquitetura</h2>

A aplicação segue os princípios da **Clean Architecture**, organizada em camadas com responsabilidades bem definidas:

```text
config/          → env validado com zod, fail-fast no boot
shared/          → erros, resposta HTTP padrão, logger (pino), segurança, validação
infrastructure/  → banco (Drizzle), cache (Redis), filas (BullMQ), HTTP (middlewares/segurança/OpenAPI)
interfaces/      → DTOs (zod) e rotas HTTP que não pertencem ao painel legado
payments/        → módulo financeiro: PaymentProvider (interface) + AsaasProvider (implementação única)
notifications/   → módulo de e-mail: EmailProvider (interface) + ResendProvider/SmtpProvider, selecionado por EMAIL_TYPE
wallet/          → WalletService — único ponto de mutação de saldo (ledger append-only, idempotente)
services/        → regras de negócio do painel admin e do bot (Drizzle)
server/          → bootstrap do Express, rotas do painel admin, middlewares, cron
bot/             → dispatcher do Telegram, fluxos (sessão por usuário via Redis), views somente leitura
```

### Decisões de arquitetura

Além da organização em camadas, a aplicação segue algumas decisões arquiteturais que mantêm o acoplamento baixo, o comportamento previsível e a manutenção simples.

O **`WalletService`** é o único componente autorizado a alterar saldos. Em vez de atualizar valores diretamente, cada crédito ou débito gera um novo registro em `wallet_transactions`, executado dentro de uma transação com `SELECT ... FOR UPDATE` e `idempotencyKey`, garantindo consistência e evitando movimentações duplicadas.

O módulo **`payments/`** isola completamente a integração com gateways de pagamento. Toda a aplicação depende apenas da interface `PaymentProvider`, o que permite trocar a implementação atual (`AsaasProvider`) sem tocar em regra de negócio nenhuma.

O mesmo princípio vale para o módulo **`notifications/`**, responsável pelo envio de e-mails: a implementação (`ResendProvider` ou `SmtpProvider`) é escolhida pela variável de ambiente `EMAIL_TYPE`, sem condicionais espalhadas pelo código.

Os **webhooks da Asaas** são processados de forma assíncrona — a API valida a assinatura da requisição e publica o evento na fila (BullMQ), enquanto o processamento roda em workers dedicados, com retry automático e deduplicação.

Por fim, o **bot do Telegram** mantém o estado das conversas no Redis, com uma sessão por usuário e um único dispatcher roteando as mensagens — sem estado global, com fluxos fáceis de acompanhar.

<h2 id="funcionalidades">✨ Funcionalidades</h2>

As funcionalidades abaixo estão organizadas pelos dois módulos que compõem o Smart Option: o **bot do Telegram**, voltado à experiência do usuário final, e a **API do painel administrativo**, voltada à gestão e operação da plataforma.

### 🤖 Bot do Telegram

O bot concentra todo o fluxo operacional do usuário, incluindo:

- Cadastro completo com nome, e-mail, senha, telefone, **CPF** (com validação por dígito verificador), endereço e chave PIX, além de verificação de e-mail.
- Autenticação com sessões isoladas por usuário, armazenadas no Redis.
- Depósitos e adesão de planos via **PIX** com a Asaas, com geração de QR Code, código copia-e-cola e confirmação automática por webhook.
- Solicitação de saques via PIX, com aprovação manual pelo painel administrativo antes do envio para a Asaas.
- Transferências internas entre usuários usando o e-mail como identificador, com operações atômicas de débito e crédito.
- Consulta de extrato financeiro e acompanhamento do status de depósitos, saques e adesões.
- Sistema de afiliados em três níveis, com bônus por adesão, mensalidade e rentabilidade da rede, respeitando o limite de três indicados comissionados por nível.
- Processamento automático do rendimento diário para usuários com plano ativo.
- Canal de suporte integrado, com possibilidade de encaminhamento para atendimento humano.

### 🌐 API do Painel Administrativo

A API fornece todos os recursos usados pelo painel administrativo, incluindo:

- Autenticação baseada em JWT com refresh tokens rotativos e detecção de reutilização de tokens.
- Rate limiting global e específico para autenticação, usando Redis como armazenamento distribuído.
- Gerenciamento completo dos usuários do bot, com consultas, filtros e ajustes manuais de saldo auditados.
- Aprovação e rejeição de solicitações de saque, além do gerenciamento de depósitos, adesões e atendimentos de suporte.
- Dashboard administrativo baseado nas movimentações reais registradas no ledger (`wallet_transactions`).
- Visualização da estrutura de afiliados de cada usuário.
- Documentação da API disponível em `GET /api/docs` (Swagger/OpenAPI).

<h2 id="stack">🛠️ Stack</h2>

| Categoria | Tecnologias |
|---|---|
| **Runtime** | Node.js 24, TypeScript 5.9 |
| **API** | Express 4, Helmet, CORS (allowlist), `express-rate-limit` (store Redis) |
| **Banco de dados** | MySQL 8.4, [Drizzle ORM](https://orm.drizzle.team/) + `drizzle-kit` (migrations versionadas) |
| **Cache e filas** | Redis 7, [BullMQ](https://docs.bullmq.io/) |
| **Pagamentos** | [Asaas](https://docs.asaas.com/) (PIX — cobrança, transferência e webhooks) |
| **Bot Telegram** | [`node-telegram-bot-api`](https://github.com/yagop/node-telegram-bot-api) |
| **Autenticação** | JWT (`jsonwebtoken`), `bcryptjs` |
| **Validação** | [Zod](https://zod.dev/) (DTOs HTTP e variáveis de ambiente) |
| **Logging** | [Pino](https://getpino.io/) estruturado, `pino-http` e `x-request-id` por requisição |
| **Testes** | [Vitest](https://vitest.dev/) + Supertest (integração com banco e Redis quando aplicável) |
| **Infraestrutura** | Docker multi-stage, Docker Compose e [Caddy](https://caddyserver.com/) (proxy reverso com TLS automático via Let's Encrypt) — ver [docs/deploy.md](docs/deploy.md) |
| **Desenvolvimento** | [Cloudflare Tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/) (túnel persistente para desenvolvimento) — ver [seção Cloudflare Tunnel](#cloudflare-tunnel) |

<h2 id="estrutura">📁 Estrutura</h2>

```text
src/
├─ config/                    # Configuração da aplicação e ambiente
├─ shared/                    # Erros, logger, validações e componentes compartilhados
├─ infrastructure/            # Banco de dados, Redis, filas, middlewares e OpenAPI
├─ interfaces/                # DTOs e rotas HTTP
├─ payments/                  # Abstração e implementação do gateway de pagamento
├─ notifications/             # Abstração e implementação do envio de e-mails
├─ wallet/                    # Ledger e gerenciamento de saldo
├─ services/                  # Regras de negócio consumidas pela API e pelo bot
├─ server/                    # Bootstrap da API, rotas, middlewares e tarefas agendadas
└─ bot/                       # Dispatcher, sessões, fluxos e interfaces do Telegram

cloudflared/
└─ config.yml                 # Configuração do túnel de desenvolvimento

scripts/
├─ lib.*                      # Funções compartilhadas
├─ start-dev.*                # Ambiente de desenvolvimento
├─ start-tunnel.*             # Cloudflare Tunnel
└─ run-platform.js            # Compatibilidade entre Windows, Linux e macOS
```

<h2 id="rotas">📍 Rotas da API</h2>

A API é organizada por módulos e documentada via **Swagger/OpenAPI** em `GET /api/docs`.

Todas as rotas protegidas exigem um **Access Token JWT** enviado no cabeçalho:

```http
Authorization: Bearer <accessToken>
```

**Rotas públicas:**

- `/health`
- `/api/health`
- `/api/docs`
- `/api/auth/*`
- `/email/verify/:token`
- `/api/webhooks/asaas`

> **Observação**
>
> Esta seção apresenta os principais endpoints da API. A documentação completa, com parâmetros, exemplos de requisição e respostas, está disponível em `GET /api/docs`.

### ❤️ Health & Documentação

| Método | Endpoint | Descrição |
|---|---|---|
| GET | `/health` | Verifica se a aplicação está em execução (*liveness*). |
| GET | `/api/health` | Verifica a disponibilidade da aplicação, MySQL e Redis (*readiness*). |
| GET | `/api/docs` | Documentação interativa da API (Swagger/OpenAPI). |

---

### 🔐 Autenticação (`/api/auth`)

| Método | Endpoint | Descrição |
|---|---|---|
| POST | `/` | Autentica um usuário do painel administrativo. |
| POST | `/refresh` | Gera um novo Access Token a partir de um Refresh Token válido. |
| POST | `/logout` | Revoga o Refresh Token atual. |
| POST | `/token` | Valida um Access Token (compatibilidade com o painel legado). |

---

### 👤 Usuários (`/api/users`)

#### Usuários do painel administrativo

| Método | Endpoint | Descrição |
|---|---|---|
| GET | `/` | Lista os usuários do painel administrativo. |
| PATCH | `/update-user` | Atualiza os dados do usuário autenticado. |
| PATCH | `/update-pass` | Atualiza a senha do usuário autenticado. |

#### Usuários do bot

| Método | Endpoint | Descrição |
|---|---|---|
| GET | `/users-bot/:search` | Pesquisa usuários por termo livre. |
| POST | `/users-bot` | Pesquisa usuários com filtros avançados. |
| POST | `/user-bot` | Cadastra um novo usuário do bot. |
| GET | `/user-bot/:id` | Consulta um usuário do bot. |
| PATCH | `/user-bot` | Atualiza um usuário do bot. |
| DELETE | `/user-bot/:id` | Remove um usuário do bot. |
| PUT | `/user-bot/:id/:status` | Ativa ou desativa um usuário. |
| POST | `/transf-user-admin` | Realiza um ajuste manual de saldo com registro em auditoria. |

---

### 📊 Dashboard (`/api/dashboard`)

| Método | Endpoint | Descrição |
|---|---|---|
| GET | `/users` | Obtém métricas de usuários. |
| GET | `/balance/:user_id/:product_id/:period` | Consulta saldo e rendimento por período. |
| GET | `/plans` | Lista os planos disponíveis. |

---

### 🌐 Rede de Afiliados (`/api/network`)

| Método | Endpoint | Descrição |
|---|---|---|
| POST | `/:id` | Consulta a estrutura de afiliados de um usuário. |

---

### 💰 Solicitações (`/api/requests`)

| Método | Endpoint | Descrição |
|---|---|---|
| GET | `/extract/:id` | Consulta o extrato financeiro de um usuário. |
| POST | `/extract/:id` | Consulta o extrato com filtros. |
| POST | `/withdrawal/:id` | Lista solicitações de saque. |
| POST | `/deposit/:id` | Lista solicitações de depósito. |
| POST | `/subscription/:id` | Lista solicitações de adesão a planos. |
| POST | `/support/:id` | Lista atendimentos de suporte. |
| POST | `/res-withdrawal` | Aprova ou rejeita uma solicitação de saque. |
| PATCH | `/was-read/:id/:status` | Marca uma solicitação de suporte como lida. |
| GET | `/pendencies` | Obtém a quantidade de pendências do sistema. |

---

### 🔗 Serviços públicos

| Método | Endpoint | Descrição |
|---|---|---|
| GET | `/email/verify/:token` | Confirma o endereço de e-mail de um usuário. |
| POST | `/api/webhooks/asaas` | Recebe eventos de pagamentos e transferências enviados pela Asaas. |

<h2 id="comecando">▶️ Começando</h2>

Esta seção descreve como configurar o ambiente de desenvolvimento local do **Smart Option Backend**.

### Pré-requisitos

- Docker e Docker Compose
- Node.js **24+** (necessário apenas para executar a API diretamente no host)
- Token de um bot do Telegram criado pelo [BotFather](https://t.me/BotFather)
- Conta Asaas Sandbox com chave de API
- Opcional: `cloudflared` instalado e autenticado para receber webhooks localmente (veja a [seção Cloudflare Tunnel](#cloudflare-tunnel))

> **Recomendação**
>
> Use um bot exclusivo para desenvolvimento e nunca reaproveite o token do ambiente de produção.

## Desenvolvimento com Docker (recomendado)

Clone o repositório e configure o ambiente:

```bash
git clone <url-do-repositorio>
cd smart-option

cp .env.development.example .env
```

Edite o arquivo `.env` e configure, no mínimo:

- `SECRET_KEY`
- `JWT_REFRESH_SECRET`
- `BOT_TOKEN`
- `BOT_USER`
- `ASAAS_API_KEY`
- configurações de e-mail (Resend ou SMTP)

Para gerar as chaves:

**Linux/macOS**

```bash
openssl rand -hex 32
```

**Windows (PowerShell)**

```powershell
-join ((1..32 | % { '{0:x2}' -f (Get-Random -Min 0 -Max 256) }))
```

Depois basta executar:

```bash
npm run dev:full
```

Esse comando orquestra automaticamente todo o ambiente de desenvolvimento:

- inicia MySQL, Redis e a API em containers Docker;
- aplica hot reload via bind mount;
- aguarda todos os serviços ficarem disponíveis;
- configura o Cloudflare Tunnel (quando instalado);
- valida os endpoints públicos usados pela Asaas;
- exibe a URL pública pronta para cadastro do webhook.

> **Observação**
>
> Se você não usa o Cloudflare Tunnel, execute apenas:
>
> ```bash
> npm run docker:up
> ```
>
> O bot continua funcionando normalmente via Long Polling, mas depósitos, adesões e saques não são confirmados automaticamente, já que dependem dos webhooks da Asaas.

## Desenvolvimento sem Docker

Também é possível executar a API diretamente no host, mantendo apenas MySQL e Redis em containers.

```bash
git clone <url-do-repositorio>
cd smart-option

npm install

cp .env.development.example .env
```

Inicie a infraestrutura:

```bash
npm run docker:up
```

Depois execute:

```bash
npm run db:migrate
npm run db:seed

npm run dev
```

A API ficará disponível em:

```text
http://localhost:<APP_PORT>
```

Se quiser expor a aplicação para receber webhooks, execute o túnel em outro terminal:

```bash
npm run tunnel
```

## Scripts disponíveis

| Script | Descrição |
|---|---|
| `npm run dev` | Executa a API e o bot diretamente no host com hot reload. |
| `npm run dev:full` | Inicia todo o ambiente Docker, configura o Cloudflare Tunnel e valida a infraestrutura. |
| `npm run docker:up` | Inicia MySQL, Redis e a API em Docker. |
| `npm run docker:down` | Remove os containers do ambiente de desenvolvimento. |
| `npm run tunnel` | Inicia apenas o Cloudflare Tunnel. |
| `npm run build` | Compila a aplicação para produção. |
| `npm start` | Executa a versão compilada da aplicação. |
| `npm test` | Executa a suíte de testes. |
| `npm run test:watch` | Executa os testes em modo watch. |
| `npm run test:coverage` | Gera o relatório de cobertura de testes. |
| `npm run lint` | Analisa o código com ESLint. |
| `npm run lint:fix` | Corrige automaticamente problemas encontrados pelo ESLint. |
| `npm run format` | Formata o código usando Prettier. |
| `npm run format:check` | Verifica se o código está formatado corretamente. |
| `npm run db:generate` | Gera migrations com o Drizzle Kit. |
| `npm run db:migrate` | Aplica as migrations pendentes. |
| `npm run db:studio` | Abre o Drizzle Studio. |
| `npm run db:seed` | Popula o banco com os dados iniciais. |
| `npm run db:backfill-wallets` | Executa o backfill do ledger de carteiras. |

<h2 id="ambientes">⚙️ Configuração de Ambientes</h2>

A aplicação usa arquivos `.env` para toda a configuração de ambiente. Não existe diferença de comportamento entre desenvolvimento e produção no código — a configuração é determinada inteiramente pelas variáveis de ambiente.

Os arquivos de exemplo disponíveis são:

| Arquivo | Finalidade | Uso |
|---|---|---|
| [.env.development.example](.env.development.example) | Desenvolvimento local (Docker, Cloudflare Tunnel e Asaas Sandbox) | Copie para `.env` na sua máquina |
| [.env.production.example](.env.production.example) | Ambiente de produção (Asaas Produção e Caddy) | Copie para `.env` na VPS |

Todas as variáveis usadas pela aplicação estão definidas nesses arquivos e são validadas na inicialização por `src/config/env.ts` com **Zod**.

Se alguma variável obrigatória estiver ausente ou com valor inválido, a aplicação interrompe a inicialização (*fail-fast*), mostrando uma mensagem de erro que indica exatamente o problema.

Variáveis com valor padrão podem ser omitidas; as que não têm são obrigatórias para o funcionamento da aplicação.

### Variáveis por categoria

| Categoria | Principais variáveis |
|---|---|
| **Aplicação** | `NODE_ENV`, `APP_PORT`, `API_BASE_PATH` |
| **Proxy reverso (produção)** | `DOMAIN`, `ACME_EMAIL` |
| **Banco de dados** | `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_DATABASE` |
| **Redis** | `REDIS_URL`, `REDIS_PORT` |
| **Autenticação** | `SECRET_KEY`, `JWT_ACCESS_EXPIRES_IN`, `JWT_REFRESH_SECRET`, `JWT_REFRESH_EXPIRES_IN` |
| **Telegram** | `BOT_TOKEN`, `BOT_USER` |
| **Logging** | `LOG_LEVEL` |
| **CORS e Rate Limiting** | `CORS_ALLOWED_ORIGINS`, `RATE_LIMIT_WINDOW_MS`, `RATE_LIMIT_MAX` |
| **Asaas** | `ASAAS_ENV`, `ASAAS_API_KEY`, `ASAAS_BASE_URL`, `ASAAS_WEBHOOK_TOKEN` |
| **Cloudflare Tunnel** | `CF_TUNNEL_ID`, `CF_TUNNEL_TOKEN`, `CF_TUNNEL_DOMAIN`, `CF_TUNNEL_HOST` |
| **E-mail** | `EMAIL_TYPE`, `RESEND_API_KEY`, `MAIL_FROM_NAME`, `MAIL_FROM_ADDRESS`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD` |

> **Importante**
>
> Valores que começam com `$` (como `ASAAS_API_KEY`) precisam ficar entre aspas simples no arquivo `.env`:
>
> ```env
> ASAAS_API_KEY='$aact_...'
> ```
>
> Veja a seção [Troubleshooting](#troubleshooting) para mais detalhes.

<h2 id="emails">📧 E-mails</h2>

O envio de e-mails é centralizado no módulo `src/notifications`, seguindo o mesmo padrão arquitetural usado em `payments/`: a aplicação depende apenas da interface `EmailProvider`, enquanto a implementação é escolhida em tempo de execução.

Toda a comunicação com provedores de e-mail passa pelo `notificationService`, responsável por operações como verificação de e-mail, recuperação de senha e notificações de depósito — mantendo controllers, serviços e fluxos do bot desacoplados da tecnologia usada.

```text
src/notifications/
├─ interfaces/     # Contratos dos provedores de e-mail
├─ providers/      # Implementações (Resend e SMTP)
├─ templates/      # Templates reutilizáveis de e-mail
├─ factory/        # Seleção do provider conforme EMAIL_TYPE
└─ services/       # Fachada consumida pelo restante da aplicação
```

### Provedores suportados

#### Resend (padrão)

Quando `EMAIL_TYPE=resend` (valor padrão), a aplicação usa a API HTTP oficial do Resend.

O remetente é definido pelas variáveis:

```env
MAIL_FROM_NAME=Smart Option
MAIL_FROM_ADDRESS=smart-option@example.url
```

Resultando em:

```text
From: Smart Option <smart-option@example.url>
```

São obrigatórias:

- `RESEND_API_KEY`
- `MAIL_FROM_NAME`
- `MAIL_FROM_ADDRESS`

#### SMTP

Quando `EMAIL_TYPE=smtp`, a aplicação usa SMTP através do Nodemailer, com suporte a TLS, timeout de conexão e retry automático para falhas transitórias.

São obrigatórias:

- `SMTP_HOST`
- `SMTP_USER`
- `SMTP_PASSWORD`

`SMTP_PORT` tem como padrão a porta **465**.

### Alterando o provedor

A troca de provedor é feita só pela variável de ambiente:

```env
EMAIL_TYPE=resend
```

ou

```env
EMAIL_TYPE=smtp
```

Nenhuma outra alteração no código é necessária.

### Adicionando um novo provedor

Para integrar um novo serviço (Amazon SES, Mailgun, Brevo, SendGrid etc.), basta:

1. implementar a interface `EmailProvider`;
2. registrar o novo provider na `email.factory.ts`;
3. adicionar as variáveis necessárias ao schema de `src/config/env.ts`.

Como toda a aplicação depende apenas da interface `EmailProvider`, nenhum controller, service ou fluxo do bot precisa ser modificado.

<h2 id="cloudflare-tunnel">☁️ Cloudflare Tunnel</h2>

Durante o desenvolvimento, a Asaas precisa acessar a API para entregar os webhooks de confirmação de pagamentos. Para isso, o projeto usa um **Cloudflare Tunnel** com domínio fixo, permitindo receber requisições públicas sem expor portas da máquina local.

> O Cloudflare Tunnel é usado **apenas em desenvolvimento**. Em produção, a aplicação é publicada normalmente através do **Caddy** com HTTPS automático.

## Instalação

| Sistema | Comando |
|---|---|
| Windows (Chocolatey) | `choco install cloudflared` |
| Windows (Scoop) | `scoop install cloudflared` |
| macOS (Homebrew) | `brew install cloudflared` |
| Linux | https://pkg.cloudflare.com/index.html |
| Manual | https://github.com/cloudflare/cloudflared/releases |

Se o `cloudflared` não estiver instalado, os comandos `npm run tunnel` e `npm run dev:full` mostram automaticamente essas instruções.

## Autenticação

Antes do primeiro uso, autentique a máquina na sua conta Cloudflare:

```bash
cloudflared tunnel login
```

O navegador abrirá para autorizar o acesso ao domínio usado pelo projeto.

Esse procedimento é feito apenas uma vez por máquina.

## Primeira execução

Depois de autenticar, basta executar:

```bash
npm run dev:full
```

ou

```bash
npm run tunnel
```

Na primeira execução o projeto:

- cria um túnel persistente;
- registra automaticamente o DNS na Cloudflare;
- salva o identificador do túnel no `.env`;
- reutiliza a mesma configuração nas próximas execuções.

Nenhuma configuração manual adicional é necessária.

## Configuração

O arquivo:

```text
cloudflared/config.yml
```

é usado como template.

Durante a execução, o projeto gera automaticamente uma configuração com base nas variáveis do `.env`, evitando duplicação de informações como domínio, porta e identificador do túnel.

## Utilização

Depois de iniciar o ambiente:

```bash
npm run dev:full
```

será exibido um resumo parecido com este:

```text
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

Cadastre a **Webhook URL** exibida no painel **Sandbox** da Asaas.

Ao encerrar a aplicação (`Ctrl + C`), o túnel também é encerrado. Os containers Docker continuam em execução até serem finalizados com:

```bash
npm run docker:down
```

## Integração com a Asaas

No painel Sandbox da Asaas:

1. acesse **Integrações → Webhooks**;
2. cadastre a URL informada pelo `npm run dev:full`;
3. configure o mesmo valor definido em `ASAAS_WEBHOOK_TOKEN`;
4. envie um evento de teste e acompanhe o processamento pelos logs da aplicação.

## Como funciona

O `cloudflared` roda diretamente no host e encaminha as requisições para a API em execução no Docker, através da porta configurada em `APP_PORT`.

Essa abordagem simplifica o ambiente de desenvolvimento e evita rodar um container adicional só para o túnel.

<h2 id="testes">🧪 Testes</h2>

O projeto usa **Vitest** para testes unitários e de integração.

### Executando os testes

| Comando | Descrição |
|---|---|
| `npm test` | Executa toda a suíte de testes. |
| `npm run test:watch` | Executa os testes em modo *watch*, reexecutando automaticamente após alterações. |
| `npm run test:coverage` | Executa a suíte completa e gera o relatório de cobertura de código. |

Os testes combinam:

- **Testes unitários**, voltados para regras de negócio isoladas;
- **Testes de integração**, usando **MySQL** e **Redis** reais executados pelo `docker-compose.dev.yml`.

Os principais fluxos cobertos incluem:

- autenticação e renovação de tokens JWT;
- movimentações do **WalletService**;
- processamento de pagamentos e webhooks;
- cálculo de comissões da rede de afiliados.

> **Importante**
>
> Para executar a suíte completa de integração, os serviços **MySQL** e **Redis** precisam estar em execução (`npm run docker:up` ou `npm run dev:full`).

Os testes rodam de forma sequencial (`fileParallelism: false`) para evitar conflitos de concorrência em operações que compartilham o mesmo banco de dados.

<h2 id="deploy">🚀 Deploy</h2>

Este guia descreve o processo de deploy do **Smart Option Backend** (API + Bot Telegram) em uma VPS Linux usando Docker Compose e Caddy.

### Pré-requisitos

- VPS Ubuntu/Debian
- acesso root ou sudo
- domínio apontado para o IP da VPS (registro A)
- Docker Engine + Docker Compose

## 1. Instalar o Docker

```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER

# Faça logout/login para aplicar o grupo docker
docker --version
docker compose version
```

Libere as portas **80** e **443** no firewall:

```bash
ufw allow 80,443/tcp
```

> Só o Caddy fica exposto à internet. A API, o MySQL e o Redis permanecem acessíveis apenas pela rede interna do Docker Compose.

## 2. Clonar o projeto

```bash
git clone <url-do-repositorio> smart-option
cd smart-option

cp .env.production.example .env
```

Edite o arquivo `.env` com os valores reais de produção.

### Configurações obrigatórias

- `SECRET_KEY`
- `JWT_REFRESH_SECRET`
- `DB_PASSWORD`
- `BOT_TOKEN`
- `BOT_USER`
- `ASAAS_API_KEY`
- `ASAAS_BASE_URL`
- `ASAAS_WEBHOOK_TOKEN`
- `CORS_ALLOWED_ORIGINS`
- `SMTP_*`
- `DOMAIN`
- `ACME_EMAIL`

Para gerar as chaves JWT:

```bash
openssl rand -hex 32
```

> **Importante**
>
> Valores que começam com `$` (como `ASAAS_API_KEY`) precisam ficar entre aspas simples:
>
> ```env
> ASAAS_API_KEY='$aact_prod_...'
> ```
>
> Sem isso, o Docker Compose pode interpretar o valor como outra variável de ambiente.

> `DB_HOST` e `REDIS_URL` não precisam ser alterados em produção — o Docker Compose já configura esses valores automaticamente para usar os serviços internos.

O arquivo `.env` é montado diretamente no container e precisa permanecer na raiz do projeto.

## 3. Iniciar banco de dados e Redis

```bash
docker compose -f docker-compose.prod.yml up -d mysql redis

docker compose -f docker-compose.prod.yml ps
```

Aguarde os dois serviços ficarem com status **healthy**.

## 4. Executar as migrations

```bash
docker compose -f docker-compose.prod.yml --profile tools run --rm migrate
```

No primeiro deploy, execute também:

```bash
docker compose -f docker-compose.prod.yml --profile tools run --rm migrate npm run db:seed
```

O seed inicial cria os produtos padrão usados pelo sistema.

## 5. Iniciar a aplicação

```bash
docker compose -f docker-compose.prod.yml up -d --build

docker compose -f docker-compose.prod.yml ps
```

O Caddy obtém automaticamente um certificado TLS válido para o domínio configurado em `DOMAIN`.

Para acompanhar o processo:

```bash
docker compose -f docker-compose.prod.yml logs -f caddy
```

Depois que o certificado for emitido, valide a aplicação:

```bash
curl https://SEU_DOMINIO/api/health
```

Também vale checar os logs da aplicação:

```bash
docker compose -f docker-compose.prod.yml logs -f app
```

### Renovação do certificado

Nenhuma configuração adicional é necessária.

O Caddy renova automaticamente os certificados do Let's Encrypt antes do vencimento, sem cron nem intervenção manual.

## 6. Operação

### Logs

```bash
docker compose -f docker-compose.prod.yml logs -f app
docker compose -f docker-compose.prod.yml logs -f caddy
```

### Atualização

```bash
git pull

docker compose -f docker-compose.prod.yml up -d --build app
```

Se houver migrations novas, execute novamente o passo **4** antes de subir a nova versão.

### Encerramento

```bash
docker compose -f docker-compose.prod.yml stop app
```

A aplicação faz um desligamento gracioso: encerra a API, o bot, o worker de webhooks e as conexões com o banco antes de finalizar o processo.

### Backup

```bash
docker compose -f docker-compose.prod.yml exec mysql \
mysqldump -u root -p"$DB_PASSWORD" "$DB_DATABASE" \
| gzip > backup-$(date +%F).sql.gz
```

Vale armazenar os backups fora da VPS.

## 7. Limitações conhecidas

- O container `app` não suporta múltiplas réplicas enquanto o bot usar **Long Polling**. Rodar duas instâncias ao mesmo tempo gera erro **409** do Telegram.

- Escalar horizontalmente exigiria separar API e bot em serviços independentes e migrar o Telegram para **Webhooks**.

- O deploy não inclui pipeline de **CI/CD** — as atualizações são feitas manualmente.

- O Caddy usa a imagem oficial, sem módulo adicional de rate limiting. A proteção contra abuso continua sendo feita pela própria aplicação, via Redis.

<h2 id="seguranca">🔒 Segurança</h2>

A segurança da aplicação foi projetada para proteger autenticação, movimentações financeiras e comunicação entre serviços.

- **Banco de dados:** todas as consultas de negócio usam Drizzle ORM com queries parametrizadas, sem SQL concatenado a partir de entradas externas.
- **Senhas:** armazenadas com **bcrypt** (custo 12). Hashes legados em **SHA-1** são migrados automaticamente para bcrypt no primeiro login (*lazy migration*).
- **Autenticação:** access tokens JWT de curta duração combinados com **refresh tokens rotativos**, com detecção de reutilização e revogação automática da família de tokens.
- **Rate limiting:** limites globais e específicos para autenticação armazenados no Redis, garantindo funcionamento consistente mesmo com múltiplas instâncias da aplicação.
- **Webhooks:** validação de assinatura com comparação em tempo constante (*constant-time comparison*), protegendo contra ataques de timing.
- **Segurança HTTP:** Helmet, política de CORS baseada em *allowlist* e `trust proxy` configurado exclusivamente para o proxy reverso da infraestrutura.
- **Infraestrutura:** só o Caddy expõe as portas **80** e **443** em produção. A API, o MySQL e o Redis permanecem isolados na rede interna do Docker Compose, com TLS emitido e renovado automaticamente pelo Let's Encrypt.
- **Segredos:** todas as credenciais vêm exclusivamente de variáveis de ambiente, sem nenhuma informação sensível no código-fonte.

<h2 id="troubleshooting">🛠️ Troubleshooting</h2>

### `cloudflared` não foi encontrado no `PATH`

O Cloudflare Tunnel não está instalado ou não está disponível no `PATH`.

Veja a [seção Cloudflare Tunnel](#cloudflare-tunnel) para instalá-lo.

---

### `cloudflared` instalado, mas a máquina não foi autenticada

Execute:

```bash
cloudflared tunnel login
```

O navegador abrirá para autenticação. Selecione a conta e a zona do domínio usado pelo projeto.

---

### `ASAAS_API_KEY` inválida dentro do Docker

Se a aplicação informar **"chave inválida"** mesmo com a variável configurada corretamente, verifique se ela está entre aspas simples.

```env
ASAAS_API_KEY='$aact_hmlg_...'
```

Como as chaves da Asaas começam com `$`, o Docker Compose pode interpretar esse caractere como uma variável de ambiente ao ler o `.env`.

---

### MySQL ou Redis permanecem como `unhealthy`

Verifique os logs dos serviços:

```bash
docker compose -f docker-compose.dev.yml logs mysql redis
```

Na primeira inicialização, o MySQL pode levar alguns segundos a mais para concluir o bootstrap.

---

### Erro `EADDRINUSE`

Outra instância da API já está usando a porta configurada em `APP_PORT`.

Finalize a instância anterior:

```bash
npm run docker:down
```

ou encerre manualmente o processo responsável pela porta.

> `npm run dev:full` reaproveita automaticamente uma API já disponível sempre que possível.

---

### Erro 409 do Telegram

```
terminated by other getUpdates request
```

O bot usa **Long Polling**, que permite só uma instância usando o mesmo `BOT_TOKEN`.

Confirme que não há outra aplicação (desenvolvimento ou produção) rodando ao mesmo tempo com o mesmo token.

---

### O registro DNS do túnel não é criado

Verifique se a conta autenticada tem acesso à zona do domínio usada pelo projeto:

```bash
cloudflared tunnel login
```

Se o registro não for criado automaticamente, ele pode ser adicionado manualmente pelo painel da Cloudflare.

<h2 id="licenca">📄 Licença</h2>

Este projeto é distribuído sob a **Smart Option Source Available License (SSAL)**.

Você pode:

- estudar o código-fonte;
- fazer um fork do repositório para fins educacionais;
- utilizar trechos da implementação como referência de aprendizado.

Você **não pode**:

- utilizar este projeto para fins comerciais;
- disponibilizá-lo como um produto ou serviço;
- criar plataformas de investimento, marketing multinível (MLM), HYIP, esquemas Ponzi, pirâmides financeiras, apostas ou qualquer outro serviço financeiro semelhante utilizando este código.

Consulte o arquivo [LICENSE](LICENSE) para os termos completos da licença.

<h2 id="related-projects">🔗 Projetos Relacionados</h2>

| Projeto | Descrição | Repositório |
|----------|-----------|-------------|
| 👑 Painel Admin (Frontend) | Interface administrativa para gerenciamento da plataforma Smart Option. | https://github.com/issagomesdev/smart-option-admin |
