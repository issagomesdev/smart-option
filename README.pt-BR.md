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
  <a href="#modo-demo">Modo Demonstração</a> •
  <a href="#testes">Testes</a> •
  <a href="#deploy">Deploy</a> •
  <a href="#seguranca">Segurança</a> •
  <a href="#troubleshooting">Troubleshooting</a> •
  <a href="#licenca">Licença</a> •
  <a href="#related-projects">Projetos Relacionados</a>
</p>

> ⚠️ **Aviso:** O **Smart Option** é um projeto de demonstração lançado exclusivamente para **estudo**, **aprendizado** e **portfólio**. Originalmente desenvolvido para atender a uma demanda real de um projeto freelancer que não chegou a ser colocado em produção, foi posteriormente evoluído como um estudo de caso para demonstrar arquitetura de software, integrações financeiras, automação e boas práticas de engenharia. **Não deve, em nenhuma hipótese, ser utilizado, adaptado ou interpretado como uma ferramenta para obtenção de ganhos financeiros reais ou para operações de investimento.**

<h2 id="sobre">📌 Sobre</h2>

**Smart Option** é uma **plataforma de investimentos automatizados** que combina a praticidade de um **bot do Telegram** com um **painel administrativo** dedicado ao gerenciamento da operação. Integrada ao **PIX** por meio do **Asaas**, a plataforma permite que os usuários realizem **depósitos**, adquiram **planos de rendimento**, acompanhem seus **rendimentos** e **movimentações financeiras**, gerenciem uma **rede de afiliados** com até **três níveis de comissão** e solicitem **saques**, tudo de forma simples, rápida e sem sair do **Telegram**.

Este repositório reúne o **backend** do **Smart Option**, responsável por toda a **lógica de negócio** da plataforma. Além de fornecer a **API REST** consumida pelo painel administrativo, a aplicação gerencia o funcionamento do **bot do Telegram**, autenticação, integrações financeiras, processamento de transações, regras de rentabilidade, sistema de afiliados, notificações e demais processos internos. Desenvolvido com **Node.js** e **TypeScript**, utiliza **MySQL** com **Drizzle ORM** para persistência de dados, **Redis** para cache e gerenciamento de sessões, além do **BullMQ** para processamento assíncrono de tarefas, formando uma arquitetura moderna, escalável e preparada para ambientes de produção.

<h2 id="arquitetura">🏗️ Arquitetura</h2>

O **Smart Option** foi projetado seguindo os princípios da **Clean Architecture**, separando responsabilidades em módulos independentes para facilitar evolução, testes e manutenção. A aplicação organiza a lógica de negócio, infraestrutura e interfaces de forma desacoplada, permitindo substituir integrações externas sem impactar as regras do domínio.

```text
config/          → Configurações, variáveis de ambiente e modo demonstração
shared/          → Componentes compartilhados (erros, logger, validações, cache, segurança)
infrastructure/  → Banco de dados, Redis, BullMQ, OpenAPI e infraestrutura HTTP
interfaces/      → DTOs, validações e rotas HTTP
payments/        → Integração com gateways de pagamento
notifications/   → Sistema de envio de e-mails
wallet/          → Controle centralizado das movimentações financeiras
services/        → Regras de negócio da plataforma
server/          → Bootstrap da aplicação, middlewares, cron jobs e agendadores
bot/             → Fluxos, sessões e interação com o Telegram
```

### Principais decisões de arquitetura

Algumas decisões foram adotadas para tornar a aplicação mais segura, desacoplada e preparada para evolução.

- **WalletService** centraliza todas as movimentações financeiras da plataforma. Nenhum outro módulo altera saldos diretamente, garantindo consistência, rastreabilidade e idempotência.

- O módulo **payments** depende apenas da interface `PaymentProvider`, permitindo substituir o gateway atual (**Asaas**) por qualquer outro sem alterar as regras de negócio.

- O módulo **notifications** segue o mesmo princípio utilizando a interface `EmailProvider`, permitindo alternar entre **Resend**, **SMTP** ou um provedor específico para o modo demonstração por meio de configuração.

- Os **webhooks da Asaas** são processados de forma assíncrona utilizando **BullMQ**, garantindo maior desempenho, retentativas automáticas e deduplicação de eventos.

- O **modo demonstração** possui uma única fonte de configuração (`config/demo.ts`), responsável por habilitar recursos exclusivos da demonstração e bloquear operações irreversíveis sem impactar o restante da aplicação.

- O **catálogo de planos** é totalmente administrável pelo painel, enquanto os planos padrão do sistema permanecem protegidos para preservar regras críticas de negócio.

- O **bot do Telegram** mantém sessões individuais no **Redis** e utiliza um único dispatcher para controlar todos os fluxos de conversa, tornando a navegação previsível e a manutenção mais simples.

- Os **seeders** permanecem desacoplados dos comandos que os executam. O mesmo catálogo de planos é reutilizado durante a criação inicial do sistema, na atualização manual dos planos e na restauração do ambiente de demonstração, evitando duplicação de dados e garantindo uma única fonte de verdade.

<h2 id="funcionalidades">✨ Funcionalidades</h2>

As funcionalidades abaixo estão organizadas pelos dois módulos que compõem o Smart Option: o **bot do Telegram**, voltado à experiência do usuário final, e a **API do painel administrativo**, voltada à gestão e operação da plataforma.

### 🤖 Bot do Telegram

O bot reúne toda a jornada do usuário em uma única interface, permitindo:

- Cadastro completo com validação de **CPF**, endereço, chave **PIX** e verificação de e-mail.
- Autenticação segura com sessões isoladas por usuário.
- Depósitos via **PIX** utilizando o **Asaas**, com QR Code, código copia-e-cola e confirmação automática por webhook.
- Contratação de **planos automáticos** diretamente pelo bot.
- Solicitação de **planos manuais**, encaminhadas para análise da equipe administrativa.
- Solicitação de saques via **PIX**, sujeitos à aprovação administrativa.
- Transferências internas entre usuários utilizando o e-mail como identificador.
- Consulta de saldo, extrato, rendimentos e histórico completo de movimentações.
- Gerenciamento de uma **rede de afiliados** com até **três níveis de comissão**.
- Processamento automático da rentabilidade conforme o plano contratado.
- Canal de suporte integrado para atendimento ao usuário.

### 🌐 API do Painel Administrativo

A API fornece todos os recursos necessários para operação da plataforma por meio do painel administrativo, incluindo:

- Autenticação baseada em **JWT**, com refresh tokens rotativos e proteção contra reutilização.
- Proteção contra abuso utilizando **Rate Limiting** distribuído com Redis.
- Dashboard administrativo com **KPIs**, gráficos, comparativos por período e indicadores consolidados da plataforma.
- Gerenciamento completo de usuários, incluindo consultas, filtros, auditoria e ajustes administrativos.
- Gestão da equipe administrativa: cadastro, edição de nome, e-mail e senha, reatribuição de papel e desativação — tudo registrado na trilha de auditoria.
- Aprovação e gerenciamento de depósitos, saques, adesões e solicitações financeiras.
- Auditoria financeira completa, com rastreabilidade de todas as movimentações da plataforma.
- Log de auditoria: registra todas as ações realizadas no painel, incluindo autor, data, horário e histórico das alterações.
- Gerenciamento da estrutura de afiliados e acompanhamento da rede de cada usuário.
- Administração completa do catálogo de planos (**AUTO** e **MANUAL**), com proteção para recursos críticos do sistema.
- **Modo Demonstração** opcional, com login de visitante, bloqueio de operações irreversíveis e restauração automática do ambiente.
- Documentação interativa da API utilizando **Swagger/OpenAPI**.

### ⚙️ Destaques da Plataforma

Além das funcionalidades principais, o projeto também inclui:

- Arquitetura baseada em **Clean Architecture** e princípios **SOLID**.
- Processamento assíncrono utilizando **BullMQ**.
- Cache distribuído e gerenciamento de sessões com **Redis**.
- Integração financeira via **Asaas**.
- Sistema de permissões baseado em **RBAC**.
- Auditoria completa das operações financeiras.
- Ambiente de demonstração independente da produção.
- Documentação técnica e API versionada.

<h2 id="stack">🛠️ Stack</h2>

| Categoria | Tecnologias |
|---|---|
| **Linguagem & Runtime** | Node.js 24, TypeScript 5.9 |
| **API & HTTP** | Express 4, Helmet, CORS (Allowlist), `express-rate-limit` (Redis Store) |
| **Banco de Dados** | MySQL 8.4, **Drizzle ORM**, `drizzle-kit` |
| **Cache & Filas** | Redis 7, BullMQ |
| **Bot** | `node-telegram-bot-api` |
| **Pagamentos** | Asaas (PIX, transferências e webhooks) |
| **Autenticação** | JWT (`jsonwebtoken`), `bcryptjs` |
| **Validação** | Zod |
| **Logs & Observabilidade** | Pino, `pino-http`, `x-request-id` |
| **Testes** | Vitest, Supertest |
| **Infraestrutura** | Docker (Multi-stage), Docker Compose, Caddy (TLS automático via Let's Encrypt) |

Durante o desenvolvimento, o projeto utiliza algumas ferramentas para simplificar a configuração do ambiente e permitir integrações externas sem a necessidade de exposição direta da máquina local.

| Ferramenta | Finalidade |
|---|---|
| **Cloudflare Tunnel** | Exposição segura do ambiente local para testes de webhooks e integrações externas. |
| **Docker Compose** | Orquestração dos serviços de desenvolvimento. |
| **Swagger / OpenAPI** | Documentação e testes da API REST. |

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

A API é organizada por módulos e documentada via **Swagger/OpenAPI** em `/api/docs`.

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

Responsável pela autenticação do painel administrativo, gerenciamento de sessões, renovação de tokens e acesso ao modo demonstração.

| Método | Endpoint | Descrição |
|---|---|---|
| POST | `/` | Autentica um administrador. |
| POST | `/demo-login` | Cria uma sessão temporária de demonstração, sem necessidade de credenciais. Disponível apenas com `APP_DEMO=true`. |
| POST | `/refresh` | Gera um novo Access Token utilizando um Refresh Token válido. |
| POST | `/logout` | Revoga o Refresh Token da sessão atual. |
| POST | `/token` | Valida um Access Token e informa se a sessão está em modo demonstração. |

---

### 👤 Usuários (`/api/users`)

Gerenciamento dos administradores do painel e dos usuários cadastrados pelo bot do Telegram.

#### Administradores

| Método | Endpoint | Descrição |
|---|---|---|
| GET | `/` | Lista os administradores cadastrados. |
| PATCH | `/update-user` | Atualiza os dados do administrador autenticado. |
| PATCH | `/update-pass` | Altera a senha do administrador autenticado. |

#### Usuários do Bot

| Método | Endpoint | Descrição |
|---|---|---|
| GET | `/users-bot/:search` | Pesquisa usuários por termo livre. |
| POST | `/users-bot` | Pesquisa usuários utilizando filtros avançados. |
| POST | `/user-bot` | Cadastra um novo usuário. |
| GET | `/user-bot/:id` | Consulta os detalhes de um usuário. |
| PATCH | `/user-bot` | Atualiza os dados de um usuário. |
| DELETE | `/user-bot/:id` | Remove um usuário. |
| PUT | `/user-bot/:id/:status` | Ativa ou desativa um usuário. |
| POST | `/transf-user-admin` | Realiza um ajuste manual de saldo com registro em auditoria. |

---

### 📊 Dashboard (`/api/dashboard`)

Endpoints responsáveis pelos indicadores estratégicos e métricas exibidos no painel administrativo.

| Método | Endpoint | Descrição |
|---|---|---|
| GET | `/summary` | Retorna os principais indicadores do dashboard, incluindo KPIs, gráficos, aprovações do dia e movimentações recentes, com filtros por período e cache em Redis. |
| GET | `/plans` | Lista os planos disponíveis para exibição no dashboard. |

---

### 📦 Planos (`/api/plans`)

Gerenciamento completo do catálogo de planos da plataforma.

| Método | Endpoint | Descrição |
|---|---|---|
| GET | `/` | Lista os planos com paginação, filtros e ordenação. |
| GET | `/:id` | Consulta os detalhes de um plano. |
| POST | `/` | Cria um novo plano. |
| PATCH | `/:id` | Atualiza as informações de um plano existente. |
| DELETE | `/:id` | Remove um plano. Planos do sistema ou com assinantes ativos não podem ser excluídos. |

---

### 🔍 Auditoria (`/api/audit`)

Duas trilhas complementares: as **movimentações financeiras** da plataforma e as **ações administrativas** — quem interveio em quê. Toda alteração de equipe, papéis, usuários do bot, bloqueio, ajuste de saldo, resposta a saque e conclusão de suporte gera um registro com autor, horário e o estado antes e depois. Redefinições de senha são marcadas como tal, sem que a senha ou o hash sejam gravados.

| Método | Endpoint | Descrição |
|---|---|---|
| POST | `/` | Retorna o histórico consolidado de movimentações financeiras, com filtros, paginação, ordenação e pesquisa avançada. |
| POST | `/actions` | Retorna o histórico de ações administrativas — quem alterou o quê no painel, com o estado antes e depois de cada mudança. |

---

### 🌐 Rede de Afiliados (`/api/network`)

Consulta da estrutura hierárquica de afiliados vinculada aos usuários.

| Método | Endpoint | Descrição |
|---|---|---|
| POST | `/:id` | Retorna a estrutura completa da rede de afiliados de um usuário. |

---

### 💰 Solicitações (`/api/requests`)

Gerenciamento de depósitos, saques, adesões, suporte e demais solicitações operacionais da plataforma.

| Método | Endpoint | Descrição |
|---|---|---|
| GET | `/extract/:id` | Consulta o extrato financeiro de um usuário. |
| POST | `/extract/:id` | Consulta o extrato utilizando filtros avançados. |
| POST | `/withdrawal/:id` | Lista as solicitações de saque. |
| POST | `/deposit/:id` | Lista os depósitos realizados. |
| POST | `/subscription/:id` | Lista as solicitações de adesão aos planos. |
| POST | `/support/:id` | Lista os atendimentos de suporte. |
| POST | `/res-withdrawal` | Aprova ou rejeita uma solicitação de saque. |
| PATCH | `/was-read/:id/:status` | Atualiza o status de leitura de um atendimento. |
| GET | `/pendencies` | Retorna o total de pendências operacionais da plataforma. |

---

### 🔗 Integrações & Endpoints Públicos

Endpoints utilizados por integrações externas e recursos acessíveis sem autenticação.

| Método | Endpoint | Descrição |
|---|---|---|
| GET | `/email/verify/:token` | Confirma o endereço de e-mail de um usuário. |
| POST | `/api/webhooks/asaas` | Recebe eventos enviados pela Asaas relacionados a pagamentos, cobranças e transferências via PIX. |

<h2 id="comecando">▶️ Começando</h2>

Esta seção descreve como configurar o ambiente de desenvolvimento local do **Smart Option**.

### Pré-requisitos

- Docker e Docker Compose
- Node.js **24+** (necessário apenas para executar a API diretamente no host)
- Token de um bot do Telegram criado pelo [BotFather](https://t.me/BotFather)
- Conta Asaas Sandbox com chave de API
- Opcional: `cloudflared` instalado e autenticado para receber webhooks localmente (veja a [seção Cloudflare Tunnel](#cloudflare-tunnel))

### Desenvolvimento com Docker (recomendado)

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

### Desenvolvimento sem Docker

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

### Scripts disponíveis

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
| `npm run db:seed` | Popula o banco com os dados iniciais (catálogo de planos + conta admin). |
| `npm run db:backfill-wallets` | Executa o backfill do ledger de carteiras. |
| `npm run plans:seed` | Garante o catálogo de planos padrão (idempotente, independe do modo demonstração). |
| `npm run demo:seed` | Limpa e regenera os dados de demonstração (**destrutivo** — equivalente a `demo:reset`). Exige `APP_DEMO=true`. |
| `npm run demo:reset` | Restaura o ambiente de demonstração ao estado inicial (**destrutivo**). Exige `APP_DEMO=true`. |

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
| **Modo demonstração** | `APP_DEMO`, `AUTO_RESET`, `AUTO_RESET_INTERVAL` |

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

### Instalação

| Sistema | Comando |
|---|---|
| Windows (Chocolatey) | `choco install cloudflared` |
| Windows (Scoop) | `scoop install cloudflared` |
| macOS (Homebrew) | `brew install cloudflared` |
| Linux | https://pkg.cloudflare.com/index.html |
| Manual | https://github.com/cloudflare/cloudflared/releases |

Se o `cloudflared` não estiver instalado, os comandos `npm run tunnel` e `npm run dev:full` mostram automaticamente essas instruções.

### Autenticação

Antes do primeiro uso, autentique a máquina na sua conta Cloudflare:

```bash
cloudflared tunnel login
```

O navegador abrirá para autorizar o acesso ao domínio usado pelo projeto.

Esse procedimento é feito apenas uma vez por máquina.

### Primeira execução

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

### Configuração

O arquivo:

```text
cloudflared/config.yml
```

é usado como template.

Durante a execução, o projeto gera automaticamente uma configuração com base nas variáveis do `.env`, evitando duplicação de informações como domínio, porta e identificador do túnel.

### Utilização

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

### Integração com a Asaas

No painel Sandbox da Asaas:

1. acesse **Integrações → Webhooks**;
2. cadastre a URL informada pelo `npm run dev:full`;
3. configure o mesmo valor definido em `ASAAS_WEBHOOK_TOKEN`;
4. envie um evento de teste e acompanhe o processamento pelos logs da aplicação.

### Como funciona

O `cloudflared` roda diretamente no host e encaminha as requisições para a API em execução no Docker, através da porta configurada em `APP_PORT`.

Essa abordagem simplifica o ambiente de desenvolvimento e evita rodar um container adicional só para o túnel.

<h2 id="modo-demo">🎭 Modo Demonstração</h2>

O **Modo Demonstração** transforma o Smart Option em um ambiente público de demonstração, permitindo que qualquer visitante explore praticamente todas as funcionalidades do sistema sem comprometer a segurança da aplicação ou realizar operações reais.

Todo o ambiente foi projetado para oferecer uma experiência próxima à produção, utilizando dados realistas, mas impedindo qualquer ação que possa afetar sistemas externos, informações críticas ou movimentações financeiras.

> ⚠️ **Todo o comportamento descrito nesta seção é controlado pela variável `APP_DEMO`.** Com `APP_DEMO=false` (valor padrão), nenhuma funcionalidade de demonstração é habilitada: a rota de login de visitante não existe, os bloqueios permanecem inativos e qualquer tentativa de executar comandos de reset é imediatamente interrompida.

### Variáveis de ambiente

| Variável | Padrão | Descrição |
|---|---|---|
| `APP_DEMO` | `false` | Habilita o modo demonstração, incluindo login de visitante, bloqueio de operações críticas e comandos de restauração do ambiente. |
| `AUTO_RESET` | `false` | Habilita a restauração automática do ambiente. **Requer `APP_DEMO=true`**. O servidor interrompe a inicialização caso essa combinação seja inválida. |
| `AUTO_RESET_INTERVAL` | *60* | Intervalo do reset automático em **minutos** (`60`, `1440`, etc.). Obrigatório quando `AUTO_RESET=true`. |

Somente valores explícitos (`true`, `1` ou `yes`) habilitam uma funcionalidade. Qualquer outro valor mantém a opção desativada.

### Login de visitante

Quando o backend está em modo demonstração, a tela de autenticação exibe o botão **Entrar como visitante**.

```http
POST /api/auth/demo-login
```

Nenhuma credencial pública é exposta.

Ao utilizar essa rota, o backend cria uma sessão temporária utilizando uma conta interna de demonstração (`visitante@demo.local`), cuja autenticação só pode ocorrer por esse endpoint.

A conta possui todas as permissões necessárias para explorar o sistema completo. A segurança da demonstração não depende da redução de permissões, mas sim do bloqueio específico das operações que poderiam causar efeitos permanentes ou externos.

### Operações bloqueadas

Durante a demonstração, determinadas ações retornam **HTTP 403** com a mensagem:

> Esta ação está desabilitada na demonstração.

O painel administrativo reflete esse comportamento, desabilitando visualmente essas ações e informando o motivo ao usuário.

| Ação | Motivo |
|---|---|
| `POST /api/requests/res-withdrawal` | Evita transferências PIX reais pela Asaas. |
| `POST` / `PATCH` / `DELETE` em `/api/staff` e `/api/roles` | Impede alterações em usuários administrativos e permissões do sistema. |
| `PATCH /api/users/update-user` e `/update-pass` | Protege as credenciais da conta administrativa compartilhada. |

Além disso, nenhuma integração externa é executada.

Quando `APP_DEMO=true`, o envio de e-mails utiliza um **provedor nulo**, registrando as mensagens apenas nos logs da aplicação.

Continuam disponíveis normalmente:

- gerenciamento de usuários do bot;
- ajustes manuais de saldo;
- gerenciamento de planos;
- movimentações financeiras fictícias;
- consultas e auditorias;
- atendimentos de suporte;
- dashboards, gráficos e relatórios.

### Restauração do ambiente

```bash
npm run demo:reset
```

O comando restaura completamente o ambiente de demonstração.

Entre as operações executadas estão:

- limpeza das tabelas transacionais;
- recriação dos dados fictícios;
- sincronização do catálogo de planos;
- limpeza do cache do dashboard;
- reconstrução da rede de afiliados;
- geração das movimentações financeiras simuladas.

Os dados administrativos permanecem preservados.

As tabelas `staff_users` e `roles` nunca são removidas, garantindo que os administradores continuem com acesso ao ambiente. Da mesma forma, `products` é sincronizada por **upsert**, preservando os identificadores utilizados internamente pela aplicação.

Caso `APP_DEMO=false`, o comando é imediatamente interrompido antes de qualquer alteração no banco.

Para habilitar a restauração automática:

```env
APP_DEMO=true
AUTO_RESET=true
AUTO_RESET_INTERVAL=60
```

O agendador utiliza o mesmo processo da aplicação e impede execuções concorrentes caso um reset ainda esteja em andamento.

### Dados de demonstração

O gerador cria automaticamente um ambiente consistente para apresentação da plataforma.

O conjunto inclui aproximadamente:

- 300 usuários;
- rede de afiliados em três níveis;
- planos ativos;
- depósitos;
- rendimentos;
- comissões;
- solicitações de saque;
- atendimentos de suporte;
- histórico financeiro;
- trilha completa de auditoria.

```bash
npm run demo:seed
```

O comando sempre recria o ambiente do zero antes de gerar novos dados, evitando o acúmulo de registros fictícios e garantindo um cenário previsível.

Atualmente, `demo:seed` reutiliza exatamente a mesma rotina utilizada por `demo:reset`, mantendo um único fluxo de geração de dados.

As mesmas validações continuam válidas: ambos os comandos só podem ser executados quando `APP_DEMO=true`.

### Características do ambiente

O ambiente de demonstração segue dois princípios fundamentais:

- **Cenário determinístico:** a estrutura da demonstração permanece consistente a cada restauração, variando apenas identificadores internos e datas relativas ao momento da execução.

- **Consistência financeira:** todos os saldos permanecem sincronizados com o ledger de transações, garantindo que dashboards, relatórios e auditorias apresentem exatamente os mesmos valores.

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

### 1. Instalar o Docker

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

### 2. Clonar o projeto

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

### 3. Iniciar banco de dados e Redis

```bash
docker compose -f docker-compose.prod.yml up -d mysql redis

docker compose -f docker-compose.prod.yml ps
```

Aguarde os dois serviços ficarem com status **healthy**.

### 4. Executar as migrations

```bash
docker compose -f docker-compose.prod.yml --profile tools run --rm migrate
```

No primeiro deploy, execute também:

```bash
docker compose -f docker-compose.prod.yml --profile tools run --rm migrate npm run db:seed
```

O seed inicial cria os produtos padrão usados pelo sistema.

### 5. Iniciar a aplicação

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

### 6. Operação

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

### 7. Limitações conhecidas

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

O **Smart Option** foi desenvolvido como um ecossistema composto por aplicações independentes, cada uma dedicada a uma responsabilidade específica. A divisão em múltiplos repositórios proporciona maior organização, facilita o desenvolvimento paralelo e torna a arquitetura mais modular e escalável.

| Projeto | Descrição | Repositório |
|----------|-----------|-------------|
| 🌐 Landing Page | Landing page oficial do Smart Option, desenvolvida para apresentar a plataforma, seus diferenciais e a experiência proposta aos usuários. | https://github.com/issagomesdev/smart-option-page |
| 👑 Painel Admin (Frontend) | Interface administrativa para gerenciamento da plataforma Smart Option. | https://github.com/issagomesdev/smart-option-admin |
