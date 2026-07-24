<p align="center">
  <b>🇺🇸 English</b> |
  <a href="./README.pt-BR.md">🇧🇷 Português</a> |
  <a href="./README.es.md">🇪🇸 Español</a>
</p>

# 🤖 Smart Option — Backend (API + Telegram Bot)

![Node.js](https://img.shields.io/badge/Node.js-24.x-green?style=for-the-badge&logo=node.js&logoColor=white) ![TypeScript](https://img.shields.io/badge/TypeScript-5.9-%23007ACC.svg?style=for-the-badge&logo=typescript&logoColor=white) ![Express.js](https://img.shields.io/badge/Express.js-4.x-%23404d59.svg?style=for-the-badge&logo=express&logoColor=white) ![Telegram](https://img.shields.io/badge/Telegram-Bot-2CA5E0?style=for-the-badge&logo=telegram&logoColor=white) ![Asaas](https://img.shields.io/badge/Asaas-PIX%20Gateway-00D084?style=for-the-badge) ![Drizzle](https://img.shields.io/badge/Drizzle-ORM-C5F74F?style=for-the-badge) ![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?style=for-the-badge&logo=docker&logoColor=white)

<p align="center">
  <a href="#about">About</a> •
  <a href="#architecture">Architecture</a> •
  <a href="#features">Features</a> •
  <a href="#stack">Stack</a> •
  <a href="#structure">Structure</a> •
  <a href="#routes">Routes</a> •
  <a href="#getting-started">Getting Started</a> •
  <a href="#environment-configuration">Environment Configuration</a> •
  <a href="#emails">Emails</a> •
  <a href="#cloudflare-tunnel">Cloudflare Tunnel</a> •
  <a href="#testing">Testing</a> •
  <a href="#deploy">Deploy</a> •
  <a href="#security">Security</a> •
  <a href="#troubleshooting">Troubleshooting</a> •
  <a href="#license">License</a> •
  <a href="#related-projects">Related Projects</a>
</p>

> ⚠️ **Heads up**: this is a demo/development environment. Don't use real production credentials (Asaas, Resend/SMTP, Telegram bot) outside a controlled deployment.

<h2 id="about">📌 About</h2>

**Smart Option** is an automated investment platform made up of two main projects: a **Telegram bot** that handles the user-facing experience, and an **admin panel**, kept in a separate repository, used to manage, monitor, and operate the platform. Through the Telegram bot, users sign up, deposit via **PIX** using **Asaas**, subscribe to monthly-yield plans, build a referral network with up to **three commission tiers**, track their transaction history, and request withdrawals — all without leaving the chat.

This repository holds the platform's **backend**, written in **Node.js** and **TypeScript**, powering both the **REST API** consumed by the admin panel and all of the bot's business logic. The application uses **MySQL** with **Drizzle ORM** for persistence, **Redis** for caching, bot session storage, and async task processing via **BullMQ** — a modern, scalable architecture built for production.

<h2 id="architecture">🏗️ Architecture</h2>

The application follows **Clean Architecture** principles, organized into layers with clearly defined responsibilities:

```text
config/          → env validated with zod, fail-fast on boot
shared/          → errors, standard HTTP response shape, logger (pino), security, validation
infrastructure/  → database (Drizzle), cache (Redis), queues (BullMQ), HTTP (middlewares/security/OpenAPI)
interfaces/      → DTOs (zod) and HTTP routes outside the legacy admin panel
payments/        → payments module: PaymentProvider (interface) + AsaasProvider (single implementation)
notifications/   → email module: EmailProvider (interface) + ResendProvider/SmtpProvider, picked via EMAIL_TYPE
wallet/          → WalletService — the only place balances get mutated (append-only, idempotent ledger)
services/        → business rules for the admin panel and the bot (Drizzle)
server/          → Express bootstrap, admin panel routes, middlewares, cron
bot/             → Telegram dispatcher, flows (per-user session via Redis), read-only views
```

### Architecture decisions

Beyond the layered layout, a few deliberate architectural choices keep coupling low, behavior predictable, and maintenance simple.

**`WalletService`** is the only component allowed to change balances. Rather than updating values in place, every credit or debit appends a new record to `wallet_transactions`, run inside a transaction with `SELECT ... FOR UPDATE` and an `idempotencyKey` — guaranteeing consistency and ruling out duplicate movements.

The **`payments/`** module fully isolates the payment gateway integration. The rest of the application depends only on the `PaymentProvider` interface, so the current implementation (`AsaasProvider`) can be swapped out without touching a single business rule.

The same principle applies to **`notifications/`**, which handles outbound email: the implementation (`ResendProvider` or `SmtpProvider`) is chosen through the `EMAIL_TYPE` environment variable, with no conditionals scattered across the codebase.

**Asaas webhooks** are processed asynchronously — the API validates the request signature and publishes the event to a queue (BullMQ), while the actual processing happens in dedicated workers with automatic retries and deduplication.

Finally, the **Telegram bot** keeps conversation state in Redis, with one session per user and a single dispatcher routing every message — no global state, and flows that stay easy to follow.

<h2 id="features">✨ Features</h2>

The features below are organized around the two modules that make up Smart Option: the **Telegram bot**, built for the end-user experience, and the **admin panel API**, built for managing and operating the platform.

### 🤖 Telegram Bot

The bot covers the user's entire operational flow, including:

- Full registration with name, email, password, phone, **CPF** (Brazil's national taxpayer ID, validated via check digit), address, and PIX key, plus email verification.
- Authentication with per-user sessions isolated in Redis.
- Deposits and plan subscriptions via **PIX** through Asaas, with QR code generation, copy-and-paste payment codes, and automatic webhook confirmation.
- Withdrawal requests via PIX, with manual approval from the admin panel before anything is sent to Asaas.
- Internal transfers between users using email as the identifier, backed by atomic debit/credit operations.
- Transaction history lookup and status tracking for deposits, withdrawals, and subscriptions.
- A three-tier referral system with sign-up bonuses, monthly fees, and network yield, capped at three commissioned referrals per tier.
- Automatic processing of daily earnings for users with an active plan.
- Built-in support channel, with the option to escalate to a human agent.

### 🌐 Admin Panel API

The API powers every resource the admin panel uses, including:

- JWT-based authentication with rotating refresh tokens and reuse detection.
- Global and auth-specific rate limiting, backed by Redis as distributed storage.
- Full management of bot users — lookups, filters, and manual balance adjustments with an audit trail.
- Approving and rejecting withdrawal requests, plus managing deposits, subscriptions, and support tickets.
- An admin dashboard driven by real transactions recorded in the ledger (`wallet_transactions`).
- A view into each user's referral network structure.
- API documentation available at `GET /api/docs` (Swagger/OpenAPI).

<h2 id="stack">🛠️ Stack</h2>

| Category | Technologies |
|---|---|
| **Runtime** | Node.js 24, TypeScript 5.9 |
| **API** | Express 4, Helmet, CORS (allowlist), `express-rate-limit` (Redis store) |
| **Database** | MySQL 8.4, [Drizzle ORM](https://orm.drizzle.team/) + `drizzle-kit` (versioned migrations) |
| **Cache & Queues** | Redis 7, [BullMQ](https://docs.bullmq.io/) |
| **Payments** | [Asaas](https://docs.asaas.com/) (PIX — charges, transfers, and webhooks) |
| **Telegram Bot** | [`node-telegram-bot-api`](https://github.com/yagop/node-telegram-bot-api) |
| **Auth** | JWT (`jsonwebtoken`), `bcryptjs` |
| **Validation** | [Zod](https://zod.dev/) (HTTP DTOs and environment variables) |
| **Logging** | Structured [Pino](https://getpino.io/), `pino-http`, per-request `x-request-id` |
| **Testing** | [Vitest](https://vitest.dev/) + Supertest (integration against real DB/Redis where it counts) |
| **Infrastructure** | Docker multi-stage, Docker Compose, and [Caddy](https://caddyserver.com/) (reverse proxy with automatic TLS via Let's Encrypt) — see [docs/deploy.md](docs/deploy.md) |
| **Development** | [Cloudflare Tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/) (persistent dev tunnel) — see the [Cloudflare Tunnel section](#cloudflare-tunnel) |

<h2 id="structure">📁 Structure</h2>

```text
src/
├─ config/                    # Application and environment configuration
├─ shared/                    # Errors, logger, validation, and shared building blocks
├─ infrastructure/            # Database, Redis, queues, middlewares, and OpenAPI
├─ interfaces/                # DTOs and HTTP routes
├─ payments/                  # Payment gateway abstraction and implementation
├─ notifications/             # Email abstraction and implementation
├─ wallet/                    # Ledger and balance management
├─ services/                  # Business rules shared by the API and the bot
├─ server/                    # API bootstrap, routes, middlewares, and scheduled jobs
└─ bot/                       # Telegram dispatcher, sessions, flows, and views

cloudflared/
└─ config.yml                 # Development tunnel configuration

scripts/
├─ lib.*                      # Shared helper functions
├─ start-dev.*                # Development environment
├─ start-tunnel.*             # Cloudflare Tunnel
└─ run-platform.js            # Windows/Linux/macOS compatibility
```

<h2 id="routes">📍 API Routes</h2>

The API is organized by module and documented through **Swagger/OpenAPI** at `GET /api/docs`.

Every protected route requires a **JWT access token** sent in the header:

```http
Authorization: Bearer <accessToken>
```

**Public routes:**

- `/health`
- `/api/health`
- `/api/docs`
- `/api/auth/*`
- `/email/verify/:token`
- `/api/webhooks/asaas`

> **Note**
>
> This section covers the main API endpoints. The full reference — parameters, request examples, and responses — lives at `GET /api/docs`.

### ❤️ Health & Docs

| Method | Endpoint | Description |
|---|---|---|
| GET | `/health` | Checks whether the application is running (*liveness*). |
| GET | `/api/health` | Checks the availability of the application, MySQL, and Redis (*readiness*). |
| GET | `/api/docs` | Interactive API documentation (Swagger/OpenAPI). |

---

### 🔐 Auth (`/api/auth`)

| Method | Endpoint | Description |
|---|---|---|
| POST | `/` | Authenticates an admin panel user. |
| POST | `/refresh` | Issues a new access token from a valid refresh token. |
| POST | `/logout` | Revokes the current refresh token. |
| POST | `/token` | Validates an access token (legacy panel compatibility). |

---

### 👤 Users (`/api/users`)

#### Admin panel users

| Method | Endpoint | Description |
|---|---|---|
| GET | `/` | Lists admin panel users. |
| PATCH | `/update-user` | Updates the authenticated user's profile. |
| PATCH | `/update-pass` | Updates the authenticated user's password. |

#### Bot users

| Method | Endpoint | Description |
|---|---|---|
| GET | `/users-bot/:search` | Searches users by free-text term. |
| POST | `/users-bot` | Searches users using advanced filters. |
| POST | `/user-bot` | Registers a new bot user. |
| GET | `/user-bot/:id` | Fetches a bot user. |
| PATCH | `/user-bot` | Updates a bot user. |
| DELETE | `/user-bot/:id` | Removes a bot user. |
| PUT | `/user-bot/:id/:status` | Activates or deactivates a user. |
| POST | `/transf-user-admin` | Applies a manual balance adjustment with an audit record. |

---

### 📊 Dashboard (`/api/dashboard`)

| Method | Endpoint | Description |
|---|---|---|
| GET | `/users` | Retrieves user metrics. |
| GET | `/balance/:user_id/:product_id/:period` | Fetches balance and yield for a given period. |
| GET | `/plans` | Lists available plans. |

---

### 🌐 Referral Network (`/api/network`)

| Method | Endpoint | Description |
|---|---|---|
| POST | `/:id` | Fetches a user's referral network structure. |

---

### 💰 Requests (`/api/requests`)

| Method | Endpoint | Description |
|---|---|---|
| GET | `/extract/:id` | Fetches a user's transaction history. |
| POST | `/extract/:id` | Fetches the transaction history with filters. |
| POST | `/withdrawal/:id` | Lists withdrawal requests. |
| POST | `/deposit/:id` | Lists deposit requests. |
| POST | `/subscription/:id` | Lists plan subscription requests. |
| POST | `/support/:id` | Lists support tickets. |
| POST | `/res-withdrawal` | Approves or rejects a withdrawal request. |
| PATCH | `/was-read/:id/:status` | Marks a support ticket as read. |
| GET | `/pendencies` | Retrieves the system's pending-item count. |

---

### 🔗 Public Services

| Method | Endpoint | Description |
|---|---|---|
| GET | `/email/verify/:token` | Confirms a user's email address. |
| POST | `/api/webhooks/asaas` | Receives payment and transfer events sent by Asaas. |

<h2 id="getting-started">▶️ Getting Started</h2>

This section walks through setting up the **Smart Option Backend** for local development.

### Requirements

- Docker and Docker Compose
- Node.js **24+** (only needed to run the API directly on the host)
- A Telegram bot token from [BotFather](https://t.me/BotFather)
- An Asaas Sandbox account with an API key
- Optional: `cloudflared` installed and authenticated, to receive webhooks locally (see the [Cloudflare Tunnel section](#cloudflare-tunnel))

> **Tip**
>
> Use a dedicated bot for development and never reuse your production token.

## Docker Development (recommended)

Clone the repository and set up the environment:

```bash
git clone <repository-url>
cd smart-option

cp .env.development.example .env
```

Edit `.env` and set, at minimum:

- `SECRET_KEY`
- `JWT_REFRESH_SECRET`
- `BOT_TOKEN`
- `BOT_USER`
- `ASAAS_API_KEY`
- your email settings (Resend or SMTP)

To generate the keys:

**Linux/macOS**

```bash
openssl rand -hex 32
```

**Windows (PowerShell)**

```powershell
-join ((1..32 | % { '{0:x2}' -f (Get-Random -Min 0 -Max 256) }))
```

Then just run:

```bash
npm run dev:full
```

This single command orchestrates the entire development environment:

- starts MySQL, Redis, and the API in Docker containers;
- enables hot reload via bind mount;
- waits for every service to become available;
- sets up the Cloudflare Tunnel (when installed);
- validates the public endpoints Asaas needs;
- prints the public URL, ready to register as a webhook.

> **Note**
>
> If you're not using the Cloudflare Tunnel, just run:
>
> ```bash
> npm run docker:up
> ```
>
> The bot keeps working normally over Long Polling, but deposits, subscriptions, and withdrawals won't confirm automatically, since those depend on Asaas webhooks.

## Development Without Docker

You can also run the API directly on the host, keeping only MySQL and Redis in containers.

```bash
git clone <repository-url>
cd smart-option

npm install

cp .env.development.example .env
```

Start the infrastructure:

```bash
npm run docker:up
```

Then run:

```bash
npm run db:migrate
npm run db:seed

npm run dev
```

The API will be available at:

```text
http://localhost:<APP_PORT>
```

To expose the app for webhooks, run the tunnel in a separate terminal:

```bash
npm run tunnel
```

## Available Scripts

| Script | Description |
|---|---|
| `npm run dev` | Runs the API and the bot directly on the host with hot reload. |
| `npm run dev:full` | Boots the full Docker environment, sets up the Cloudflare Tunnel, and validates the infrastructure. |
| `npm run docker:up` | Starts MySQL, Redis, and the API in Docker. |
| `npm run docker:down` | Tears down the development containers. |
| `npm run tunnel` | Starts only the Cloudflare Tunnel. |
| `npm run build` | Compiles the application for production. |
| `npm start` | Runs the compiled build. |
| `npm test` | Runs the test suite. |
| `npm run test:watch` | Runs tests in watch mode. |
| `npm run test:coverage` | Generates the test coverage report. |
| `npm run lint` | Lints the codebase with ESLint. |
| `npm run lint:fix` | Auto-fixes ESLint findings where possible. |
| `npm run format` | Formats the codebase with Prettier. |
| `npm run format:check` | Checks that the codebase is properly formatted. |
| `npm run db:generate` | Generates migrations with Drizzle Kit. |
| `npm run db:migrate` | Applies pending migrations. |
| `npm run db:studio` | Opens Drizzle Studio. |
| `npm run db:seed` | Seeds the database with initial data. |
| `npm run db:backfill-wallets` | Runs the wallet ledger backfill. |

<h2 id="environment-configuration">⚙️ Environment Configuration</h2>

The application relies entirely on `.env` files for environment configuration. There's no dev-vs-production branching in the code itself — behavior is driven exclusively by environment variables.

The example files provided are:

| File | Purpose | Usage |
|---|---|---|
| [.env.development.example](.env.development.example) | Local development (Docker, Cloudflare Tunnel, Asaas Sandbox) | Copy to `.env` on your machine |
| [.env.production.example](.env.production.example) | Production environment (Asaas Production, Caddy) | Copy to `.env` on the VPS |

Every variable the application reads is defined in these files and validated at startup by `src/config/env.ts` with **Zod**.

If a required variable is missing or has an invalid value, the application refuses to start (*fail-fast*), printing an error message that points to exactly what's wrong.

Variables with a default value can be omitted; the rest are required for the app to run.

### Variables by Category

| Category | Key Variables |
|---|---|
| **Application** | `NODE_ENV`, `APP_PORT`, `API_BASE_PATH` |
| **Reverse proxy (production)** | `DOMAIN`, `ACME_EMAIL` |
| **Database** | `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_DATABASE` |
| **Redis** | `REDIS_URL`, `REDIS_PORT` |
| **Auth** | `SECRET_KEY`, `JWT_ACCESS_EXPIRES_IN`, `JWT_REFRESH_SECRET`, `JWT_REFRESH_EXPIRES_IN` |
| **Telegram** | `BOT_TOKEN`, `BOT_USER` |
| **Logging** | `LOG_LEVEL` |
| **CORS & Rate Limiting** | `CORS_ALLOWED_ORIGINS`, `RATE_LIMIT_WINDOW_MS`, `RATE_LIMIT_MAX` |
| **Asaas** | `ASAAS_ENV`, `ASAAS_API_KEY`, `ASAAS_BASE_URL`, `ASAAS_WEBHOOK_TOKEN` |
| **Cloudflare Tunnel** | `CF_TUNNEL_ID`, `CF_TUNNEL_TOKEN`, `CF_TUNNEL_DOMAIN`, `CF_TUNNEL_HOST` |
| **Email** | `EMAIL_TYPE`, `RESEND_API_KEY`, `MAIL_FROM_NAME`, `MAIL_FROM_ADDRESS`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD` |

> **Important**
>
> Values starting with `$` (like `ASAAS_API_KEY`) must stay wrapped in single quotes in `.env`:
>
> ```env
> ASAAS_API_KEY='$aact_...'
> ```
>
> See the [Troubleshooting](#troubleshooting) section for details.

<h2 id="emails">📧 Emails</h2>

Email delivery is centralized in the `src/notifications` module, following the same architectural pattern as `payments/`: the application depends only on the `EmailProvider` interface, while the concrete implementation is chosen at runtime.

All communication with email providers flows through `notificationService`, which handles things like email verification, password recovery, and deposit notifications — keeping controllers, services, and bot flows decoupled from whichever provider is behind them.

```text
src/notifications/
├─ interfaces/     # Email provider contracts
├─ providers/      # Implementations (Resend and SMTP)
├─ templates/      # Reusable email templates
├─ factory/        # Provider selection based on EMAIL_TYPE
└─ services/       # Facade consumed by the rest of the application
```

### Supported Providers

#### Resend (default)

When `EMAIL_TYPE=resend` (the default), the application uses Resend's official HTTP API.

The sender is set through:

```env
MAIL_FROM_NAME=Smart Option
MAIL_FROM_ADDRESS=smart-option@example.url
```

Which produces:

```text
From: Smart Option <smart-option@example.url>
```

Required:

- `RESEND_API_KEY`
- `MAIL_FROM_NAME`
- `MAIL_FROM_ADDRESS`

#### SMTP

When `EMAIL_TYPE=smtp`, the application sends mail via SMTP through Nodemailer, with TLS support, connection timeouts, and automatic retries for transient failures.

Required:

- `SMTP_HOST`
- `SMTP_USER`
- `SMTP_PASSWORD`

`SMTP_PORT` defaults to **465**.

### Switching Providers

Switching providers is purely a matter of the environment variable:

```env
EMAIL_TYPE=resend
```

or

```env
EMAIL_TYPE=smtp
```

No code changes needed.

### Adding a New Provider

To integrate a new service (Amazon SES, Mailgun, Brevo, SendGrid, etc.), you just need to:

1. implement the `EmailProvider` interface;
2. register the new provider in `email.factory.ts`;
3. add the required variables to the `src/config/env.ts` schema.

Since the whole application depends only on the `EmailProvider` interface, no controller, service, or bot flow needs to change.

<h2 id="cloudflare-tunnel">☁️ Cloudflare Tunnel</h2>

During development, Asaas needs to reach the API to deliver payment confirmation webhooks. To make that possible, the project uses a **Cloudflare Tunnel** with a fixed domain, allowing it to receive public requests without exposing any ports on your local machine.

> The Cloudflare Tunnel is used **only in development**. In production, the application is served through **Caddy** with automatic HTTPS.

## Installation

| System | Command |
|---|---|
| Windows (Chocolatey) | `choco install cloudflared` |
| Windows (Scoop) | `scoop install cloudflared` |
| macOS (Homebrew) | `brew install cloudflared` |
| Linux | https://pkg.cloudflare.com/index.html |
| Manual | https://github.com/cloudflare/cloudflared/releases |

If `cloudflared` isn't installed, both `npm run tunnel` and `npm run dev:full` will print these instructions automatically.

## Authentication

Before first use, authenticate the machine with your Cloudflare account:

```bash
cloudflared tunnel login
```

Your browser will open to authorize access to the domain used by the project.

You only need to do this once per machine.

## First Run

Once authenticated, just run:

```bash
npm run dev:full
```

or

```bash
npm run tunnel
```

On the first run, the project:

- creates a persistent tunnel;
- automatically registers the DNS record on Cloudflare;
- saves the tunnel ID to `.env`;
- reuses that same configuration on every subsequent run.

No further manual setup required.

## Configuration

The file:

```text
cloudflared/config.yml
```

is used as a template.

At runtime, the project automatically generates a full configuration from the variables in `.env`, avoiding duplicated info like domain, port, and tunnel ID.

## Usage

After starting the environment:

```bash
npm run dev:full
```

you'll see a summary along these lines:

```text
========================================

Smart Option API

Running:

http://localhost:<APP_PORT>

Cloudflare Tunnel:

https://example.url

Webhook URL:

https://example.url/api/webhooks/asaas

========================================
```

Register the **Webhook URL** shown there in Asaas's **Sandbox** panel.

When you stop the application (`Ctrl + C`), the tunnel stops with it. The Docker containers keep running until you tear them down with:

```bash
npm run docker:down
```

## Integrating with Asaas

In the Asaas Sandbox panel:

1. go to **Integrations → Webhooks**;
2. register the URL printed by `npm run dev:full`;
3. set it to the same value configured in `ASAAS_WEBHOOK_TOKEN`;
4. send a test event and watch it get processed in the application logs.

## How It Works

`cloudflared` runs directly on the host and forwards requests to the API running in Docker, through the port configured in `APP_PORT`.

This keeps the development setup simple and avoids running an extra container just for the tunnel.

<h2 id="testing">🧪 Testing</h2>

The project uses **Vitest** for unit and integration testing.

### Running the Tests

| Command | Description |
|---|---|
| `npm test` | Runs the full test suite. |
| `npm run test:watch` | Runs tests in *watch* mode, re-running automatically on changes. |
| `npm run test:coverage` | Runs the full suite and generates a code coverage report. |

The tests combine:

- **Unit tests**, focused on isolated business rules;
- **Integration tests**, run against real **MySQL** and **Redis** via `docker-compose.dev.yml`.

The main flows covered include:

- JWT authentication and token refresh;
- **WalletService** balance movements;
- payment processing and webhooks;
- referral network commission calculations.

> **Important**
>
> To run the full integration suite, **MySQL** and **Redis** need to be up (`npm run docker:up` or `npm run dev:full`).

Tests run sequentially (`fileParallelism: false`) to avoid concurrency conflicts on operations that share the same database.

<h2 id="deploy">🚀 Deploy</h2>

This guide covers deploying the **Smart Option Backend** (API + Telegram Bot) to a Linux VPS using Docker Compose and Caddy.

### Requirements

- Ubuntu/Debian VPS
- root or sudo access
- a domain pointed at the VPS's IP (A record)
- Docker Engine + Docker Compose

## 1. Install Docker

```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER

# Log out and back in for the docker group to take effect
docker --version
docker compose version
```

Open ports **80** and **443** in the firewall:

```bash
ufw allow 80,443/tcp
```

> Only Caddy is exposed to the internet. The API, MySQL, and Redis stay reachable only through Docker Compose's internal network.

## 2. Clone the Project

```bash
git clone <repository-url> smart-option
cd smart-option

cp .env.production.example .env
```

Edit `.env` with your real production values.

### Required Settings

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

To generate the JWT secrets:

```bash
openssl rand -hex 32
```

> **Important**
>
> Values starting with `$` (like `ASAAS_API_KEY`) must stay wrapped in single quotes:
>
> ```env
> ASAAS_API_KEY='$aact_prod_...'
> ```
>
> Otherwise, Docker Compose may interpret the value as a reference to another environment variable.

> `DB_HOST` and `REDIS_URL` don't need to be changed in production — Docker Compose automatically points them at the internal services.

The `.env` file is mounted directly into the container and needs to stay at the project root.

## 3. Start the Database and Redis

```bash
docker compose -f docker-compose.prod.yml up -d mysql redis

docker compose -f docker-compose.prod.yml ps
```

Wait until both services report **healthy**.

## 4. Run the Migrations

```bash
docker compose -f docker-compose.prod.yml --profile tools run --rm migrate
```

On the first deploy, also run:

```bash
docker compose -f docker-compose.prod.yml --profile tools run --rm migrate npm run db:seed
```

The initial seed creates the default products the system expects.

## 5. Start the Application

```bash
docker compose -f docker-compose.prod.yml up -d --build

docker compose -f docker-compose.prod.yml ps
```

Caddy automatically obtains a valid TLS certificate for the domain set in `DOMAIN`.

To watch the process:

```bash
docker compose -f docker-compose.prod.yml logs -f caddy
```

Once the certificate is issued, verify the deployment:

```bash
curl https://YOUR_DOMAIN/api/health
```

It's also worth checking the application logs:

```bash
docker compose -f docker-compose.prod.yml logs -f app
```

### Certificate Renewal

No extra setup needed.

Caddy automatically renews Let's Encrypt certificates before they expire — no cron job, no manual steps.

## 6. Operations

### Logs

```bash
docker compose -f docker-compose.prod.yml logs -f app
docker compose -f docker-compose.prod.yml logs -f caddy
```

### Updating

```bash
git pull

docker compose -f docker-compose.prod.yml up -d --build app
```

If there are new migrations, run step **4** again before bringing up the new version.

### Shutting Down

```bash
docker compose -f docker-compose.prod.yml stop app
```

The application shuts down gracefully — closing the API, stopping the bot, draining the webhook worker, and closing the database connections before the process exits.

### Backup

```bash
docker compose -f docker-compose.prod.yml exec mysql \
mysqldump -u root -p"$DB_PASSWORD" "$DB_DATABASE" \
| gzip > backup-$(date +%F).sql.gz
```

Store backups somewhere outside the VPS.

## 7. Known Limitations

- The `app` container doesn't support multiple replicas while the bot uses **Long Polling**. Running two instances at once triggers a Telegram **409** error.

- Horizontal scaling would require splitting the API and the bot into separate services and switching the bot to Telegram **webhooks**.

- The deploy doesn't include a **CI/CD** pipeline — updates are done manually.

- Caddy runs the official image, with no extra rate-limiting module. Abuse protection remains the application's job, via Redis.

<h2 id="security">🔒 Security</h2>

The application's security model is built around protecting authentication, financial transactions, and inter-service communication.

- **Database:** every business query goes through Drizzle ORM with parameterized queries — no SQL concatenated from external input.
- **Passwords:** stored with **bcrypt** (cost factor 12). Legacy **SHA-1** hashes are automatically migrated to bcrypt on first login (*lazy migration*).
- **Authentication:** short-lived JWT access tokens paired with **rotating refresh tokens**, including reuse detection and automatic revocation of the entire token family.
- **Rate limiting:** global and auth-specific limits stored in Redis, staying consistent even across multiple application instances.
- **Webhooks:** signature validation using constant-time comparison, protecting against timing attacks.
- **HTTP security:** Helmet, an allowlist-based CORS policy, and `trust proxy` scoped exclusively to the infrastructure's reverse proxy.
- **Infrastructure:** only Caddy exposes ports **80** and **443** in production. The API, MySQL, and Redis stay isolated on Docker Compose's internal network, with TLS issued and renewed automatically by Let's Encrypt.
- **Secrets:** every credential comes exclusively from environment variables — nothing sensitive lives in the source code.

<h2 id="troubleshooting">🛠️ Troubleshooting</h2>

### `cloudflared` not found in `PATH`

The Cloudflare Tunnel isn't installed, or it's not on your `PATH`.

See the [Cloudflare Tunnel section](#cloudflare-tunnel) to install it.

---

### `cloudflared` is installed, but the machine isn't authenticated

Run:

```bash
cloudflared tunnel login
```

Your browser will open for authentication. Select the account and the domain zone used by the project.

---

### `ASAAS_API_KEY` looks invalid inside Docker

If the application reports an **"invalid key"** error even though the variable is set correctly, check whether it's wrapped in single quotes.

```env
ASAAS_API_KEY='$aact_hmlg_...'
```

Since Asaas keys start with `$`, Docker Compose can interpret that character as an environment variable reference while parsing `.env`.

---

### MySQL or Redis stay `unhealthy`

Check the service logs:

```bash
docker compose -f docker-compose.dev.yml logs mysql redis
```

On first boot, MySQL can take a few extra seconds to finish its bootstrap process.

---

### `EADDRINUSE` error

Another API instance is already using the port set in `APP_PORT`.

Stop the previous instance:

```bash
npm run docker:down
```

or manually kill whatever process holds the port.

> `npm run dev:full` automatically reuses an already-running API whenever it can.

---

### Telegram 409 error

```
terminated by other getUpdates request
```

The bot uses **Long Polling**, which only allows one instance per `BOT_TOKEN`.

Make sure no other instance (development or production) is running at the same time with the same token.

---

### The tunnel's DNS record isn't created

Check that the authenticated account has access to the domain zone used by the project:

```bash
cloudflared tunnel login
```

If the record isn't created automatically, you can add it manually from the Cloudflare dashboard.

<h2 id="license">📄 License</h2>

This project is distributed under the **Smart Option Source Available License (SSAL)**.

You are welcome to:

- study the source code;
- fork the repository for educational purposes;
- use parts of the implementation as a learning reference.

You may **not**:

- use this project commercially;
- deploy it as a product or service;
- build investment, MLM, HYIP, Ponzi, pyramid, betting, or similar financial platforms from this code.

See the [LICENSE](LICENSE) file for the complete terms.


<h2 id="related-projects">🔗 Related Projects</h2>

| Project | Description | Repository |
|----------|-----------|-------------|
| 👑 Admin Panel (Frontend) | Admin interface for managing the Smart Option platform. | https://github.com/issagomesdev/smart-option-admin |
