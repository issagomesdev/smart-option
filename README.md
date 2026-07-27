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
  <a href="#configuration">Configuration</a> •
  <a href="#emails">Emails</a> •
  <a href="#cloudflare-tunnel">Cloudflare Tunnel</a> •
  <a href="#demo-mode">Demo Mode</a> •
  <a href="#testing">Testing</a> •
  <a href="#deployment">Deployment</a> •
  <a href="#security">Security</a> •
  <a href="#troubleshooting">Troubleshooting</a> •
  <a href="#license">License</a> •
  <a href="#related-projects">Related Projects</a>
</p>

> ⚠️ **Disclaimer:** **Smart Option** is a demonstration project released exclusively for **learning**, **educational purposes**, and **portfolio presentation**. Originally developed to meet the requirements of a real freelance project that was never deployed to production, it was later expanded into a case study showcasing software architecture, financial integrations, automation, and engineering best practices. **Under no circumstances should it be used, adapted, or interpreted as a tool for generating real financial returns or for real-world investment activities.**

<h2 id="about">📌 About</h2>

**Smart Option** is an **automated investment platform** that combines the convenience of a **Telegram bot** with a dedicated **admin panel** for managing the operation. Integrated with **PIX** through **Asaas**, the platform lets users make **deposits**, purchase **yield plans**, track their **earnings** and **financial transactions**, manage an **affiliate network** with up to **three commission tiers**, and request **withdrawals** — all quickly and without ever leaving **Telegram**.

This repository holds the **Smart Option backend**, which owns the platform's entire **business logic**. Beyond serving the **REST API** consumed by the admin panel, it runs the **Telegram bot**, authentication, financial integrations, transaction processing, yield rules, the affiliate system, notifications, and other internal processes. Built with **Node.js** and **TypeScript**, it uses **MySQL** with **Drizzle ORM** for persistence, **Redis** for caching and session management, and **BullMQ** for asynchronous job processing — a modern, scalable architecture ready for production environments.

<h2 id="architecture">🏗️ Architecture</h2>

**Smart Option** follows **Clean Architecture** principles, splitting responsibilities into independent modules to make the codebase easier to evolve, test, and maintain. Business logic, infrastructure, and interfaces stay decoupled, so external integrations can be swapped without touching the domain rules.

```text
config/          → Configuration, environment variables, and demo mode
shared/          → Shared building blocks (errors, logger, validation, cache, security)
infrastructure/  → Database, Redis, BullMQ, OpenAPI, and HTTP infrastructure
interfaces/      → DTOs, validation, and HTTP routes
payments/        → Payment gateway integration
notifications/   → Email delivery system
wallet/          → Centralized control of financial transactions
services/        → Platform business rules
server/          → Application bootstrap, middleware, cron jobs, and schedulers
bot/             → Telegram flows, sessions, and interaction
```

### Key architectural decisions

A few decisions were made to keep the application secure, decoupled, and ready to evolve.

- **WalletService** centralizes every financial transaction on the platform. No other module changes balances directly, which guarantees consistency, traceability, and idempotency.

- The **payments** module depends only on the `PaymentProvider` interface, so the current gateway (**Asaas**) can be replaced by any other without touching business rules.

- The **notifications** module follows the same principle through the `EmailProvider` interface, allowing you to switch between **Resend**, **SMTP**, or a demo-specific provider purely through configuration.

- **Asaas webhooks** are processed asynchronously with **BullMQ**, which improves throughput and brings automatic retries and event deduplication.

- **Demo mode** has a single source of configuration (`config/demo.ts`), responsible for enabling demo-only features and blocking irreversible operations without leaking into the rest of the application.

- The **plan catalog** is fully manageable from the admin panel, while the system's default plans stay protected to preserve critical business rules.

- The **Telegram bot** keeps per-user sessions in **Redis** and routes every conversation flow through a single dispatcher, making navigation predictable and maintenance simpler.

- **Seeders** stay decoupled from the commands that run them. The same plan catalog is reused during initial setup, manual plan updates, and demo environment restores — no duplicated data, one single source of truth.

<h2 id="features">✨ Features</h2>

The features below are grouped by the two modules that make up Smart Option: the **Telegram bot**, focused on the end-user experience, and the **admin panel API**, focused on managing and operating the platform.

### 🤖 Telegram Bot

The bot brings the entire user journey into a single interface:

- Full sign-up with **CPF** validation, address, **PIX** key, and email verification.
- Secure authentication with isolated per-user sessions.
- **PIX** deposits through **Asaas**, with QR code, copy-and-paste code, and automatic webhook confirmation.
- Purchase of **automatic plans** directly from the bot.
- Requests for **manual plans**, routed to the admin team for review.
- **PIX** withdrawal requests, subject to admin approval.
- Internal transfers between users, using email as the identifier.
- Balance, statement, earnings, and complete transaction history.
- Management of an **affiliate network** with up to **three commission tiers**.
- Automatic yield processing based on the purchased plan.
- Built-in support channel for user assistance.

### 🌐 Admin Panel API

The API exposes everything needed to run the platform from the admin panel:

- **JWT**-based authentication with rotating refresh tokens and reuse detection.
- Abuse protection through distributed **rate limiting** backed by Redis.
- Admin dashboard with **KPIs**, charts, period-over-period comparisons, and consolidated platform metrics.
- Complete user management, including search, filters, audit trails, and administrative adjustments.
- Approval and management of deposits, withdrawals, subscriptions, and financial requests.
- Full financial audit, with traceability for every transaction on the platform.
- Affiliate structure management and per-user network tracking.
- Complete administration of the plan catalog (**AUTO** and **MANUAL**), with safeguards for critical system resources.
- Optional **demo mode**, with guest sign-in, blocking of irreversible operations, and automatic environment restore.
- Interactive API documentation via **Swagger/OpenAPI**.

### ⚙️ Platform Highlights

Beyond the core features, the project also includes:

- Architecture based on **Clean Architecture** and **SOLID** principles.
- Asynchronous processing with **BullMQ**.
- Distributed caching and session management with **Redis**.
- Financial integration via **Asaas**.
- **RBAC**-based permission system.
- Full audit trail for financial operations.
- A demo environment fully isolated from production.
- Technical documentation and a versioned API.

<h2 id="stack">🛠️ Stack</h2>

| Category | Technologies |
|---|---|
| **Language & Runtime** | Node.js 24, TypeScript 5.9 |
| **API & HTTP** | Express 4, Helmet, CORS (allowlist), `express-rate-limit` (Redis store) |
| **Database** | MySQL 8.4, **Drizzle ORM**, `drizzle-kit` |
| **Cache & Queues** | Redis 7, BullMQ |
| **Bot** | `node-telegram-bot-api` |
| **Payments** | Asaas (PIX, transfers, and webhooks) |
| **Authentication** | JWT (`jsonwebtoken`), `bcryptjs` |
| **Validation** | Zod |
| **Logging & Observability** | Pino, `pino-http`, `x-request-id` |
| **Testing** | Vitest, Supertest |
| **Infrastructure** | Docker (multi-stage), Docker Compose, Caddy (automatic TLS via Let's Encrypt) |

During development, the project relies on a few tools to simplify environment setup and enable external integrations without exposing the local machine directly.

| Tool | Purpose |
|---|---|
| **Cloudflare Tunnel** | Securely exposes the local environment for webhook testing and external integrations. |
| **Docker Compose** | Orchestrates the development services. |
| **Swagger / OpenAPI** | REST API documentation and testing. |

<h2 id="structure">📁 Structure</h2>

```text
src/
├─ config/                    # Application and environment configuration
├─ shared/                    # Errors, logger, validation, and shared building blocks
├─ infrastructure/            # Database, Redis, queues, middleware, and OpenAPI
├─ interfaces/                # DTOs and HTTP routes
├─ payments/                  # Payment gateway abstraction and implementation
├─ notifications/             # Email delivery abstraction and implementation
├─ wallet/                    # Ledger and balance management
├─ services/                  # Business rules consumed by the API and the bot
├─ server/                    # API bootstrap, routes, middleware, and scheduled jobs
└─ bot/                       # Telegram dispatcher, sessions, flows, and interfaces

cloudflared/
└─ config.yml                 # Development tunnel configuration

scripts/
├─ lib.*                      # Shared functions
├─ start-dev.*                # Development environment
├─ start-tunnel.*             # Cloudflare Tunnel
└─ run-platform.js            # Windows, Linux, and macOS compatibility
```

<h2 id="routes">📍 API Routes</h2>

The API is organized into modules and documented with **Swagger/OpenAPI** at `/api/docs`.

Every protected route requires a **JWT access token** in the header:

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
> This section covers the API's main endpoints. Full documentation, with parameters, request examples, and responses, is available at `GET /api/docs`.

### ❤️ Health & Documentation

| Method | Endpoint | Description |
|---|---|---|
| GET | `/health` | Checks whether the application is running (*liveness*). |
| GET | `/api/health` | Checks the availability of the application, MySQL, and Redis (*readiness*). |
| GET | `/api/docs` | Interactive API documentation (Swagger/OpenAPI). |

---

### 🔐 Authentication (`/api/auth`)

Handles admin panel authentication, session management, token renewal, and demo mode access.

| Method | Endpoint | Description |
|---|---|---|
| POST | `/` | Authenticates an admin. |
| POST | `/demo-login` | Creates a temporary demo session, no credentials required. Available only when `APP_DEMO=true`. |
| POST | `/refresh` | Issues a new access token from a valid refresh token. |
| POST | `/logout` | Revokes the current session's refresh token. |
| POST | `/token` | Validates an access token and reports whether the session is in demo mode. |

---

### 👤 Users (`/api/users`)

Management of panel admins and of the users registered through the Telegram bot.

#### Admins

| Method | Endpoint | Description |
|---|---|---|
| GET | `/` | Lists the registered admins. |
| PATCH | `/update-user` | Updates the authenticated admin's details. |
| PATCH | `/update-pass` | Changes the authenticated admin's password. |

#### Bot Users

| Method | Endpoint | Description |
|---|---|---|
| GET | `/users-bot/:search` | Searches users by free-text term. |
| POST | `/users-bot` | Searches users with advanced filters. |
| POST | `/user-bot` | Creates a new user. |
| GET | `/user-bot/:id` | Retrieves a user's details. |
| PATCH | `/user-bot` | Updates a user's details. |
| DELETE | `/user-bot/:id` | Deletes a user. |
| PUT | `/user-bot/:id/:status` | Activates or deactivates a user. |
| POST | `/transf-user-admin` | Performs a manual balance adjustment with an audit record. |

---

### 📊 Dashboard (`/api/dashboard`)

Endpoints behind the strategic metrics shown in the admin panel.

| Method | Endpoint | Description |
|---|---|---|
| GET | `/summary` | Returns the dashboard's main metrics, including KPIs, charts, approvals for the day, and recent activity, with period filters and Redis caching. |
| GET | `/plans` | Lists the plans available for display in the dashboard. |

---

### 📦 Plans (`/api/plans`)

Complete management of the platform's plan catalog.

| Method | Endpoint | Description |
|---|---|---|
| GET | `/` | Lists plans with pagination, filters, and sorting. |
| GET | `/:id` | Retrieves a plan's details. |
| POST | `/` | Creates a new plan. |
| PATCH | `/:id` | Updates an existing plan. |
| DELETE | `/:id` | Deletes a plan. System plans and plans with active subscribers can't be deleted. |

---

### 🔍 Financial Audit (`/api/audit`)

Complete, auditable view of every financial transaction on the platform.

| Method | Endpoint | Description |
|---|---|---|
| POST | `/` | Returns the consolidated transaction history, with filters, pagination, sorting, and advanced search. |

---

### 🌐 Affiliate Network (`/api/network`)

Lookup of the affiliate hierarchy tied to each user.

| Method | Endpoint | Description |
|---|---|---|
| POST | `/:id` | Returns the complete affiliate network for a user. |

---

### 💰 Requests (`/api/requests`)

Management of deposits, withdrawals, subscriptions, support, and other operational requests.

| Method | Endpoint | Description |
|---|---|---|
| GET | `/extract/:id` | Retrieves a user's financial statement. |
| POST | `/extract/:id` | Retrieves the statement using advanced filters. |
| POST | `/withdrawal/:id` | Lists withdrawal requests. |
| POST | `/deposit/:id` | Lists deposits. |
| POST | `/subscription/:id` | Lists plan subscription requests. |
| POST | `/support/:id` | Lists support tickets. |
| POST | `/res-withdrawal` | Approves or rejects a withdrawal request. |
| PATCH | `/was-read/:id/:status` | Updates the read status of a support ticket. |
| GET | `/pendencies` | Returns the platform's total pending items. |

---

### 🔗 Integrations & Public Endpoints

Endpoints used by external integrations and resources available without authentication.

| Method | Endpoint | Description |
|---|---|---|
| GET | `/email/verify/:token` | Confirms a user's email address. |
| POST | `/api/webhooks/asaas` | Receives Asaas events for payments, charges, and PIX transfers. |

<h2 id="getting-started">▶️ Getting Started</h2>

This section walks through setting up the **Smart Option** local development environment.

### Requirements

- Docker and Docker Compose
- Node.js **24+** (only needed to run the API directly on the host)
- A Telegram bot token created with [BotFather](https://t.me/BotFather)
- An Asaas Sandbox account with an API key
- Optional: `cloudflared` installed and authenticated to receive webhooks locally (see the [Cloudflare Tunnel section](#cloudflare-tunnel))

### Development with Docker (recommended)

Clone the repository and set up the environment:

```bash
git clone <repository-url>
cd smart-option

cp .env.development.example .env
```

Edit the `.env` file and set at least:

- `SECRET_KEY`
- `JWT_REFRESH_SECRET`
- `BOT_TOKEN`
- `BOT_USER`
- `ASAAS_API_KEY`
- email settings (Resend or SMTP)

To generate the keys:

**Linux/macOS**

```bash
openssl rand -hex 32
```

**Windows (PowerShell)**

```powershell
-join ((1..32 | % { '{0:x2}' -f (Get-Random -Min 0 -Max 256) }))
```

Then simply run:

```bash
npm run dev:full
```

This command orchestrates the entire development environment for you:

- starts MySQL, Redis, and the API in Docker containers;
- enables hot reload through a bind mount;
- waits for every service to become available;
- sets up the Cloudflare Tunnel (when installed);
- validates the public endpoints used by Asaas;
- prints the public URL, ready to register as a webhook.

> **Note**
>
> If you're not using the Cloudflare Tunnel, just run:
>
> ```bash
> npm run docker:up
> ```
>
> The bot keeps working normally over long polling, but deposits, subscriptions, and withdrawals won't be confirmed automatically, since they depend on Asaas webhooks.

### Development without Docker

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

If you want to expose the application to receive webhooks, run the tunnel in a separate terminal:

```bash
npm run tunnel
```

### Available scripts

| Script | Description |
|---|---|
| `npm run dev` | Runs the API and the bot directly on the host with hot reload. |
| `npm run dev:full` | Starts the full Docker environment, sets up the Cloudflare Tunnel, and validates the infrastructure. |
| `npm run docker:up` | Starts MySQL, Redis, and the API in Docker. |
| `npm run docker:down` | Removes the development containers. |
| `npm run tunnel` | Starts the Cloudflare Tunnel only. |
| `npm run build` | Compiles the application for production. |
| `npm start` | Runs the compiled application. |
| `npm test` | Runs the test suite. |
| `npm run test:watch` | Runs the tests in watch mode. |
| `npm run test:coverage` | Generates the test coverage report. |
| `npm run lint` | Lints the code with ESLint. |
| `npm run lint:fix` | Auto-fixes issues found by ESLint. |
| `npm run format` | Formats the code with Prettier. |
| `npm run format:check` | Checks whether the code is properly formatted. |
| `npm run db:generate` | Generates migrations with Drizzle Kit. |
| `npm run db:migrate` | Applies pending migrations. |
| `npm run db:studio` | Opens Drizzle Studio. |
| `npm run db:seed` | Seeds the database with the initial data (plan catalog + admin account). |
| `npm run db:backfill-wallets` | Backfills the wallet ledger from the legacy balance history. |
| `npm run plans:seed` | Ensures the default plan catalog exists (idempotent, independent of demo mode). |
| `npm run demo:seed` | Wipes and regenerates the demo data (**destructive** — equivalent to `demo:reset`). Requires `APP_DEMO=true`. |
| `npm run demo:reset` | Restores the demo environment to its initial state (**destructive**). Requires `APP_DEMO=true`. |

<h2 id="configuration">⚙️ Configuration</h2>

The application uses `.env` files for all environment configuration. There is no behavioral difference between development and production in the code — everything is driven by environment variables.

The available example files are:

| File | Purpose | Usage |
|---|---|---|
| [.env.development.example](.env.development.example) | Local development (Docker, Cloudflare Tunnel, and Asaas Sandbox) | Copy to `.env` on your machine |
| [.env.production.example](.env.production.example) | Production environment (Asaas Production and Caddy) | Copy to `.env` on the VPS |

Every variable the application uses is defined in those files and validated at startup by `src/config/env.ts` with **Zod**.

If a required variable is missing or invalid, the application stops during startup (*fail-fast*) with an error message pointing at exactly what's wrong.

Variables with a default value can be omitted; the ones without a default are required for the application to run.

### Variables by category

| Category | Main variables |
|---|---|
| **Application** | `NODE_ENV`, `APP_PORT`, `API_BASE_PATH` |
| **Reverse proxy (production)** | `DOMAIN`, `ACME_EMAIL` |
| **Database** | `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_DATABASE` |
| **Redis** | `REDIS_URL`, `REDIS_PORT` |
| **Authentication** | `SECRET_KEY`, `JWT_ACCESS_EXPIRES_IN`, `JWT_REFRESH_SECRET`, `JWT_REFRESH_EXPIRES_IN` |
| **Telegram** | `BOT_TOKEN`, `BOT_USER` |
| **Logging** | `LOG_LEVEL` |
| **CORS & rate limiting** | `CORS_ALLOWED_ORIGINS`, `RATE_LIMIT_WINDOW_MS`, `RATE_LIMIT_MAX` |
| **Asaas** | `ASAAS_ENV`, `ASAAS_API_KEY`, `ASAAS_BASE_URL`, `ASAAS_WEBHOOK_TOKEN` |
| **Cloudflare Tunnel** | `CF_TUNNEL_ID`, `CF_TUNNEL_TOKEN`, `CF_TUNNEL_DOMAIN`, `CF_TUNNEL_HOST` |
| **Email** | `EMAIL_TYPE`, `RESEND_API_KEY`, `MAIL_FROM_NAME`, `MAIL_FROM_ADDRESS`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD` |
| **Demo mode** | `APP_DEMO`, `AUTO_RESET`, `AUTO_RESET_INTERVAL` |

> **Important**
>
> Values starting with `$` (such as `ASAAS_API_KEY`) must be wrapped in single quotes in the `.env` file:
>
> ```env
> ASAAS_API_KEY='$aact_...'
> ```
>
> See the [Troubleshooting](#troubleshooting) section for details.

<h2 id="emails">📧 Emails</h2>

Email delivery lives in the `src/notifications` module and follows the same architectural pattern as `payments/`: the application depends only on the `EmailProvider` interface, while the implementation is chosen at runtime.

All communication with email providers goes through `notificationService`, which handles operations like email verification, password recovery, and deposit notifications — keeping controllers, services, and bot flows decoupled from the underlying technology.

```text
src/notifications/
├─ interfaces/     # Email provider contracts
├─ providers/      # Implementations (Resend and SMTP)
├─ templates/      # Reusable email templates
├─ factory/        # Provider selection based on EMAIL_TYPE
└─ services/       # Facade consumed by the rest of the application
```

### Supported providers

#### Resend (default)

With `EMAIL_TYPE=resend` (the default), the application uses Resend's official HTTP API.

The sender is defined by:

```env
MAIL_FROM_NAME=Smart Option
MAIL_FROM_ADDRESS=smart-option@example.url
```

Which results in:

```text
From: Smart Option <smart-option@example.url>
```

Required variables:

- `RESEND_API_KEY`
- `MAIL_FROM_NAME`
- `MAIL_FROM_ADDRESS`

#### SMTP

With `EMAIL_TYPE=smtp`, the application uses SMTP through Nodemailer, with TLS support, connection timeout, and automatic retry for transient failures.

Required variables:

- `SMTP_HOST`
- `SMTP_USER`
- `SMTP_PASSWORD`

`SMTP_PORT` defaults to port **465**.

### Switching providers

Changing providers is done entirely through the environment variable:

```env
EMAIL_TYPE=resend
```

or

```env
EMAIL_TYPE=smtp
```

No other code changes are needed.

### Adding a new provider

To integrate a new service (Amazon SES, Mailgun, Brevo, SendGrid, etc.):

1. implement the `EmailProvider` interface;
2. register the new provider in `email.factory.ts`;
3. add the required variables to the schema in `src/config/env.ts`.

Since the entire application depends only on the `EmailProvider` interface, no controller, service, or bot flow needs to change.

<h2 id="cloudflare-tunnel">☁️ Cloudflare Tunnel</h2>

During development, Asaas needs to reach the API to deliver payment confirmation webhooks. To make that possible, the project uses a **Cloudflare Tunnel** with a fixed domain, accepting public requests without exposing any ports on the local machine.

> The Cloudflare Tunnel is used **in development only**. In production, the application is published through **Caddy** with automatic HTTPS.

### Installation

| System | Command |
|---|---|
| Windows (Chocolatey) | `choco install cloudflared` |
| Windows (Scoop) | `scoop install cloudflared` |
| macOS (Homebrew) | `brew install cloudflared` |
| Linux | https://pkg.cloudflare.com/index.html |
| Manual | https://github.com/cloudflare/cloudflared/releases |

If `cloudflared` isn't installed, `npm run tunnel` and `npm run dev:full` print these instructions automatically.

### Authentication

Before the first run, authenticate the machine against your Cloudflare account:

```bash
cloudflared tunnel login
```

Your browser will open so you can authorize access to the domain used by the project.

This only needs to be done once per machine.

### First run

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
- registers the DNS record on Cloudflare automatically;
- saves the tunnel ID in `.env`;
- reuses the same configuration on subsequent runs.

No additional manual setup is required.

### Configuration

The file:

```text
cloudflared/config.yml
```

is used as a template.

At runtime, the project generates the configuration from the `.env` variables, avoiding duplicated values such as domain, port, and tunnel ID.

### Usage

After starting the environment:

```bash
npm run dev:full
```

you'll see a summary like this:

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

Register the **Webhook URL** shown above in the Asaas **Sandbox** dashboard.

When you stop the application (`Ctrl + C`), the tunnel shuts down too. Docker containers keep running until you stop them with:

```bash
npm run docker:down
```

### Asaas integration

In the Asaas Sandbox dashboard:

1. go to **Integrations → Webhooks**;
2. register the URL printed by `npm run dev:full`;
3. set the same value defined in `ASAAS_WEBHOOK_TOKEN`;
4. send a test event and follow the processing in the application logs.

### How it works

`cloudflared` runs directly on the host and forwards requests to the API running in Docker, through the port set in `APP_PORT`.

This keeps the development environment simple and avoids running an extra container just for the tunnel.

<h2 id="demo-mode">🎭 Demo Mode</h2>

**Demo mode** turns Smart Option into a public showcase, letting any visitor explore virtually every feature without compromising the application's security or performing real operations.

The whole environment is designed to feel close to production, with realistic data, while preventing any action that could affect external systems, critical information, or real money.

> ⚠️ **Everything described in this section is controlled by the `APP_DEMO` variable.** With `APP_DEMO=false` (the default), none of it exists: the guest sign-in route isn't registered, the blocks stay inactive, and any attempt to run a reset command stops immediately.

### Environment variables

| Variable | Default | Description |
|---|---|---|
| `APP_DEMO` | `false` | Enables demo mode, including guest sign-in, blocking of critical operations, and the environment restore commands. |
| `AUTO_RESET` | `false` | Enables automatic environment restore. **Requires `APP_DEMO=true`**. The server refuses to start if the combination is invalid. |
| `AUTO_RESET_INTERVAL` | *60* | Automatic reset interval in **minutes** (`60`, `1440`, etc.). Required when `AUTO_RESET=true`. |

Only explicit values (`true`, `1`, or `yes`) enable a feature. Anything else leaves it turned off.

### Guest sign-in

When the backend runs in demo mode, the sign-in screen shows an **Enter as guest** button.

```http
POST /api/auth/demo-login
```

No public credentials are exposed.

When this route is used, the backend creates a temporary session on an internal demo account (`visitante@demo.local`) that can only be authenticated through this endpoint.

The account holds every permission needed to explore the full system. The demo's safety doesn't come from reduced permissions, but from specifically blocking the operations that could cause permanent or external effects.

### Blocked operations

During the demo, certain actions return **HTTP 403** with the message:

> This action is disabled in the demo.

The admin panel mirrors this behavior, visually disabling those actions and explaining why to the user.

| Action | Reason |
|---|---|
| `POST /api/requests/res-withdrawal` | Prevents real PIX transfers through Asaas. |
| `POST` / `PATCH` / `DELETE` on `/api/staff` and `/api/roles` | Prevents changes to admin users and system permissions. |
| `PATCH /api/users/update-user` and `/update-pass` | Protects the credentials of the shared admin account. |

On top of that, no external integration is executed.

When `APP_DEMO=true`, email delivery uses a **null provider** that only records messages in the application logs.

Still fully available:

- bot user management;
- manual balance adjustments;
- plan management;
- simulated financial transactions;
- queries and audits;
- support tickets;
- dashboards, charts, and reports.

### Restoring the environment

```bash
npm run demo:reset
```

This command fully restores the demo environment.

Among the operations it runs:

- clearing the transactional tables;
- recreating the fictional data;
- syncing the plan catalog;
- clearing the dashboard cache;
- rebuilding the affiliate network;
- generating the simulated financial transactions.

Administrative data is preserved.

The `staff_users` and `roles` tables are never wiped, so admins keep access to the environment. Likewise, `products` is synced through an **upsert**, preserving the identifiers the application relies on internally.

If `APP_DEMO=false`, the command stops immediately, before any change reaches the database.

To enable automatic restores:

```env
APP_DEMO=true
AUTO_RESET=true
AUTO_RESET_INTERVAL=60
```

The scheduler runs in the same process as the application and skips a cycle if a previous reset is still in progress.

### Demo data

The generator builds a consistent environment for showcasing the platform.

The dataset includes roughly:

- 300 users;
- a three-tier affiliate network;
- active plans;
- deposits;
- earnings;
- commissions;
- withdrawal requests;
- support tickets;
- financial history;
- a complete audit trail.

```bash
npm run demo:seed
```

The command always rebuilds the environment from scratch before generating new data, which avoids piling up fictional records and keeps the scenario predictable.

Right now, `demo:seed` reuses exactly the same routine as `demo:reset`, keeping a single data-generation path.

The same guards still apply: both commands only run when `APP_DEMO=true`.

#### Environment characteristics

The demo environment follows two core principles:

- **Deterministic scenario:** the shape of the demo stays consistent across restores, with only internal identifiers and dates relative to the run time varying.

- **Financial consistency:** every balance stays in sync with the transaction ledger, so dashboards, reports, and audits always show exactly the same numbers.

<h2 id="testing">🧪 Testing</h2>

The project uses **Vitest** for unit and integration tests.

### Running the tests

| Command | Description |
|---|---|
| `npm test` | Runs the entire test suite. |
| `npm run test:watch` | Runs the tests in *watch* mode, re-running automatically on changes. |
| `npm run test:coverage` | Runs the full suite and generates the code coverage report. |

The tests combine:

- **Unit tests**, focused on isolated business rules;
- **Integration tests**, running against real **MySQL** and **Redis** instances started by `docker-compose.dev.yml`.

The main flows covered include:

- authentication and JWT token renewal;
- **WalletService** transactions;
- payment and webhook processing;
- affiliate network commission calculation.

> **Important**
>
> To run the full integration suite, **MySQL** and **Redis** must be running (`npm run docker:up` or `npm run dev:full`).

Tests run sequentially (`fileParallelism: false`) to avoid concurrency conflicts in operations that share the same database.

<h2 id="deployment">🚀 Deployment</h2>

This guide walks through deploying the **Smart Option Backend** (API + Telegram bot) to a Linux VPS using Docker Compose and Caddy.

### Requirements

- Ubuntu/Debian VPS
- root or sudo access
- a domain pointed at the VPS IP (A record)
- Docker Engine + Docker Compose

### 1. Install Docker

```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER

# Log out and back in to apply the docker group
docker --version
docker compose version
```

Open ports **80** and **443** on the firewall:

```bash
ufw allow 80,443/tcp
```

> Only Caddy is exposed to the internet. The API, MySQL, and Redis stay reachable only through the Docker Compose internal network.

### 2. Clone the project

```bash
git clone <repository-url> smart-option
cd smart-option

cp .env.production.example .env
```

Edit the `.env` file with your real production values.

#### Required settings

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

To generate the JWT keys:

```bash
openssl rand -hex 32
```

> **Important**
>
> Values starting with `$` (such as `ASAAS_API_KEY`) must be wrapped in single quotes:
>
> ```env
> ASAAS_API_KEY='$aact_prod_...'
> ```
>
> Without them, Docker Compose may interpret the value as another environment variable.

> `DB_HOST` and `REDIS_URL` don't need to change in production — Docker Compose already points them at the internal services.

The `.env` file is mounted directly into the container and must stay in the project root.

### 3. Start the database and Redis

```bash
docker compose -f docker-compose.prod.yml up -d mysql redis

docker compose -f docker-compose.prod.yml ps
```

Wait for both services to report **healthy**.

### 4. Run the migrations

```bash
docker compose -f docker-compose.prod.yml --profile tools run --rm migrate
```

On the first deployment, also run:

```bash
docker compose -f docker-compose.prod.yml --profile tools run --rm migrate npm run db:seed
```

The initial seed creates the default products used by the system.

### 5. Start the application

```bash
docker compose -f docker-compose.prod.yml up -d --build

docker compose -f docker-compose.prod.yml ps
```

Caddy automatically obtains a valid TLS certificate for the domain set in `DOMAIN`.

To follow the process:

```bash
docker compose -f docker-compose.prod.yml logs -f caddy
```

Once the certificate is issued, verify the application:

```bash
curl https://YOUR_DOMAIN/api/health
```

It's also worth checking the application logs:

```bash
docker compose -f docker-compose.prod.yml logs -f app
```

#### Certificate renewal

No additional setup is required.

Caddy renews Let's Encrypt certificates automatically before they expire — no cron job, no manual step.

### 6. Operations

#### Logs

```bash
docker compose -f docker-compose.prod.yml logs -f app
docker compose -f docker-compose.prod.yml logs -f caddy
```

#### Updating

```bash
git pull

docker compose -f docker-compose.prod.yml up -d --build app
```

If there are new migrations, run step **4** again before bringing up the new version.

#### Shutting down

```bash
docker compose -f docker-compose.prod.yml stop app
```

The application shuts down gracefully: it closes the API, the bot, the webhook worker, and the database connections before exiting.

#### Backups

```bash
docker compose -f docker-compose.prod.yml exec mysql \
mysqldump -u root -p"$DB_PASSWORD" "$DB_DATABASE" \
| gzip > backup-$(date +%F).sql.gz
```

Store backups outside the VPS.

### 7. Known limitations

- The `app` container doesn't support multiple replicas while the bot uses **long polling**. Running two instances at once triggers a **409** error from Telegram.

- Scaling horizontally would require splitting the API and the bot into separate services and moving Telegram to **webhooks**.

- The deployment doesn't include a **CI/CD** pipeline — updates are performed manually.

- Caddy uses the official image, without an additional rate limiting module. Abuse protection is still handled by the application itself, through Redis.

<h2 id="security">🔒 Security</h2>

The application's security model focuses on protecting authentication, financial transactions, and communication between services.

- **Database:** every business query uses Drizzle ORM with parameterized queries — no SQL built by concatenating external input.
- **Passwords:** stored with **bcrypt** (cost 12). Legacy **SHA-1** hashes are migrated to bcrypt on the next successful login (*lazy migration*).
- **Authentication:** short-lived JWT access tokens combined with **rotating refresh tokens**, including reuse detection and automatic revocation of the entire token family.
- **Rate limiting:** global and auth-specific limits stored in Redis, so behavior stays consistent even across multiple application instances.
- **Webhooks:** signature validation using *constant-time comparison*, protecting against timing attacks.
- **HTTP security:** Helmet, allowlist-based CORS policy, and `trust proxy` configured exclusively for the infrastructure's reverse proxy.
- **Infrastructure:** only Caddy exposes ports **80** and **443** in production. The API, MySQL, and Redis stay isolated on the Docker Compose internal network, with TLS issued and renewed automatically by Let's Encrypt.
- **Secrets:** all credentials come exclusively from environment variables — no sensitive data in the source code.

<h2 id="troubleshooting">🛠️ Troubleshooting</h2>

### `cloudflared` not found in `PATH`

The Cloudflare Tunnel isn't installed or isn't available in your `PATH`.

See the [Cloudflare Tunnel section](#cloudflare-tunnel) to install it.

---

### `cloudflared` installed, but the machine isn't authenticated

Run:

```bash
cloudflared tunnel login
```

Your browser will open for authentication. Select the account and the zone for the domain used by the project.

---

### Invalid `ASAAS_API_KEY` inside Docker

If the application reports an **"invalid key"** even though the variable is set correctly, check that it's wrapped in single quotes.

```env
ASAAS_API_KEY='$aact_hmlg_...'
```

Because Asaas keys start with `$`, Docker Compose may treat that character as an environment variable when reading the `.env` file.

---

### MySQL or Redis stuck as `unhealthy`

Check the service logs:

```bash
docker compose -f docker-compose.dev.yml logs mysql redis
```

On the very first startup, MySQL may take a few extra seconds to finish bootstrapping.

---

### `EADDRINUSE` error

Another API instance is already using the port set in `APP_PORT`.

Stop the previous instance:

```bash
npm run docker:down
```

or kill the process holding the port manually.

> `npm run dev:full` automatically reuses an already-running API whenever possible.

---

### Telegram 409 error

```
terminated by other getUpdates request
```

The bot uses **long polling**, which allows only one instance per `BOT_TOKEN`.

Make sure no other application (development or production) is running with the same token at the same time.

---

### The tunnel's DNS record isn't created

Check that the authenticated account has access to the domain zone used by the project:

```bash
cloudflared tunnel login
```

If the record isn't created automatically, you can add it manually from the Cloudflare dashboard.

<h2 id="license">📄 License</h2>

This project is distributed under the **Smart Option Source Available License (SSAL)**.

You may:

- study the source code;
- fork the repository for educational purposes;
- use parts of the implementation as a learning reference.

You may **not**:

- use this project for commercial purposes;
- offer it as a product or service;
- build investment platforms, multi-level marketing (MLM), HYIP, Ponzi schemes, financial pyramids, gambling, or any similar financial service on top of this code.

See the [LICENSE](LICENSE) file for the full terms.

<h2 id="related-projects">🔗 Related Projects</h2>

**Smart Option** was built as an ecosystem of independent applications, each with a clear responsibility. Splitting it across repositories keeps things organized, makes parallel development easier, and results in a more modular, scalable architecture.

| Project | Description | Repository |
|----------|-----------|-------------|
| 🌐 Landing Page | The official Smart Option landing page, built to introduce the platform, what sets it apart, and the experience it offers users. | https://github.com/issagomesdev/smart-option-page |
| 👑 Admin Panel (Frontend) | The administrative interface for managing the Smart Option platform. | https://github.com/issagomesdev/smart-option-admin |
