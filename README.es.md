<p align="center">
  <a href="./README.md">🇺🇸 English</a> |
  <a href="./README.pt-BR.md">🇧🇷 Português</a> |
  <b>🇪🇸 Español</b>
</p>

# 🤖 Smart Option — Backend (API + Bot de Telegram)

![Node.js](https://img.shields.io/badge/Node.js-24.x-green?style=for-the-badge&logo=node.js&logoColor=white) ![TypeScript](https://img.shields.io/badge/TypeScript-5.9-%23007ACC.svg?style=for-the-badge&logo=typescript&logoColor=white) ![Express.js](https://img.shields.io/badge/Express.js-4.x-%23404d59.svg?style=for-the-badge&logo=express&logoColor=white) ![Telegram](https://img.shields.io/badge/Telegram-Bot-2CA5E0?style=for-the-badge&logo=telegram&logoColor=white) ![Asaas](https://img.shields.io/badge/Asaas-PIX%20Gateway-00D084?style=for-the-badge) ![Drizzle](https://img.shields.io/badge/Drizzle-ORM-C5F74F?style=for-the-badge) ![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?style=for-the-badge&logo=docker&logoColor=white)

<p align="center">
  <a href="#acerca-de">Acerca de</a> •
  <a href="#arquitectura">Arquitectura</a> •
  <a href="#funcionalidades">Funcionalidades</a> •
  <a href="#stack">Stack</a> •
  <a href="#estructura">Estructura</a> •
  <a href="#rutas">Rutas</a> •
  <a href="#primeros-pasos">Primeros Pasos</a> •
  <a href="#configuracion-de-entornos">Configuración de Entornos</a> •
  <a href="#correos">Correos</a> •
  <a href="#cloudflare-tunnel">Cloudflare Tunnel</a> •
  <a href="#pruebas">Pruebas</a> •
  <a href="#despliegue">Despliegue</a> •
  <a href="#seguridad">Seguridad</a> •
  <a href="#solucion-de-problemas">Solución de Problemas</a> •
  <a href="#licencia">Licencia</a>  •
  <a href="#related-projects">Proyectos Relacionados</a>
</p>

> ⚠️ **Aviso**: este es un entorno de demostración/desarrollo. No uses credenciales reales de producción (Asaas, Resend/SMTP, bot de Telegram) fuera de un despliegue controlado.

<h2 id="acerca-de">📌 Acerca de</h2>

**Smart Option** es una plataforma de inversión automatizada compuesta por dos proyectos principales: un **bot de Telegram**, encargado de la experiencia del usuario, y un **panel administrativo**, mantenido en un repositorio aparte, usado para gestionar, monitorear y operar la plataforma. A través del bot de Telegram, los usuarios se registran, depositan vía **PIX** con **Asaas**, contratan planes de rendimiento mensual, construyen una red de afiliados con hasta **tres niveles de comisión**, revisan su historial de movimientos y solicitan retiros — todo sin salir del chat.

Este repositorio contiene el **backend** de la plataforma, escrito en **Node.js** y **TypeScript**, responsable tanto de la **API REST** que consume el panel administrativo como de toda la lógica de negocio del bot. La aplicación usa **MySQL** con **Drizzle ORM** para persistencia, **Redis** para caché, sesiones del bot y procesamiento asíncrono con **BullMQ** — una arquitectura moderna, escalable y lista para producción.

<h2 id="arquitectura">🏗️ Arquitectura</h2>

La aplicación sigue los principios de **Clean Architecture**, organizada en capas con responsabilidades bien definidas:

```text
config/          → env validado con zod, fail-fast al iniciar
shared/          → errores, formato estándar de respuesta HTTP, logger (pino), seguridad, validación
infrastructure/  → base de datos (Drizzle), caché (Redis), colas (BullMQ), HTTP (middlewares/seguridad/OpenAPI)
interfaces/      → DTOs (zod) y rutas HTTP que no pertenecen al panel legado
payments/        → módulo financiero: PaymentProvider (interfaz) + AsaasProvider (única implementación)
notifications/   → módulo de correo: EmailProvider (interfaz) + ResendProvider/SmtpProvider, elegido por EMAIL_TYPE
wallet/          → WalletService — el único punto que puede modificar saldos (ledger append-only, idempotente)
services/        → reglas de negocio del panel admin y del bot (Drizzle)
server/          → bootstrap de Express, rutas del panel admin, middlewares, cron
bot/             → dispatcher de Telegram, flujos (sesión por usuario vía Redis), vistas de solo lectura
```

### Decisiones de arquitectura

Más allá de la organización en capas, la aplicación sigue algunas decisiones arquitectónicas que mantienen el acoplamiento bajo, el comportamiento predecible y el mantenimiento simple.

**`WalletService`** es el único componente autorizado para modificar saldos. En lugar de actualizar valores directamente, cada crédito o débito genera un nuevo registro en `wallet_transactions`, ejecutado dentro de una transacción con `SELECT ... FOR UPDATE` e `idempotencyKey`, lo que garantiza consistencia y evita movimientos duplicados.

El módulo **`payments/`** aísla por completo la integración con pasarelas de pago. Toda la aplicación depende únicamente de la interfaz `PaymentProvider`, lo que permite reemplazar la implementación actual (`AsaasProvider`) sin tocar ninguna regla de negocio.

El mismo principio aplica al módulo **`notifications/`**, encargado del envío de correos: la implementación (`ResendProvider` o `SmtpProvider`) se elige mediante la variable de entorno `EMAIL_TYPE`, sin condicionales repartidos por el código.

Los **webhooks de Asaas** se procesan de forma asíncrona — la API valida la firma de la solicitud y publica el evento en una cola (BullMQ), mientras el procesamiento ocurre en workers dedicados, con reintentos automáticos y deduplicación.

Por último, el **bot de Telegram** mantiene el estado de las conversaciones en Redis, con una sesión por usuario y un único dispatcher que enruta los mensajes — sin estado global, y con flujos fáciles de seguir.

<h2 id="funcionalidades">✨ Funcionalidades</h2>

Las funcionalidades siguientes están organizadas según los dos módulos que componen Smart Option: el **bot de Telegram**, pensado para la experiencia del usuario final, y la **API del panel administrativo**, pensada para la gestión y operación de la plataforma.

### 🤖 Bot de Telegram

El bot concentra todo el flujo operativo del usuario, incluyendo:

- Registro completo con nombre, correo, contraseña, teléfono, **CPF** (identificación fiscal brasileña, validada por dígito verificador), dirección y clave PIX, además de verificación de correo.
- Autenticación con sesiones aisladas por usuario, almacenadas en Redis.
- Depósitos y contratación de planes vía **PIX** con Asaas, con generación de código QR, código copia-y-pega, y confirmación automática por webhook.
- Solicitud de retiros vía PIX, con aprobación manual desde el panel administrativo antes de enviarse a Asaas.
- Transferencias internas entre usuarios usando el correo como identificador, con operaciones atómicas de débito y crédito.
- Consulta del historial financiero y seguimiento del estado de depósitos, retiros y contrataciones.
- Sistema de afiliados en tres niveles, con bonos por inscripción, mensualidad y rendimiento de la red, respetando el límite de tres referidos comisionados por nivel.
- Procesamiento automático del rendimiento diario para usuarios con plan activo.
- Canal de soporte integrado, con posibilidad de derivar a un agente humano.

### 🌐 API del Panel Administrativo

La API provee todos los recursos que utiliza el panel administrativo, incluyendo:

- Autenticación basada en JWT con refresh tokens rotativos y detección de reutilización de tokens.
- Rate limiting global y específico para autenticación, usando Redis como almacenamiento distribuido.
- Gestión completa de los usuarios del bot, con búsquedas, filtros y ajustes manuales de saldo con registro de auditoría.
- Aprobación y rechazo de solicitudes de retiro, además de la gestión de depósitos, contrataciones y tickets de soporte.
- Dashboard administrativo basado en los movimientos reales registrados en el ledger (`wallet_transactions`).
- Visualización de la estructura de afiliados de cada usuario.
- Documentación de la API disponible en `GET /api/docs` (Swagger/OpenAPI).

<h2 id="stack">🛠️ Stack</h2>

| Categoría | Tecnologías |
|---|---|
| **Runtime** | Node.js 24, TypeScript 5.9 |
| **API** | Express 4, Helmet, CORS (allowlist), `express-rate-limit` (almacenamiento en Redis) |
| **Base de datos** | MySQL 8.4, [Drizzle ORM](https://orm.drizzle.team/) + `drizzle-kit` (migrations versionadas) |
| **Caché y colas** | Redis 7, [BullMQ](https://docs.bullmq.io/) |
| **Pagos** | [Asaas](https://docs.asaas.com/) (PIX — cobros, transferencias y webhooks) |
| **Bot de Telegram** | [`node-telegram-bot-api`](https://github.com/yagop/node-telegram-bot-api) |
| **Autenticación** | JWT (`jsonwebtoken`), `bcryptjs` |
| **Validación** | [Zod](https://zod.dev/) (DTOs HTTP y variables de entorno) |
| **Logging** | [Pino](https://getpino.io/) estructurado, `pino-http` y `x-request-id` por solicitud |
| **Pruebas** | [Vitest](https://vitest.dev/) + Supertest (integración contra base de datos y Redis reales cuando corresponde) |
| **Infraestructura** | Docker multi-stage, Docker Compose y [Caddy](https://caddyserver.com/) (proxy reverso con TLS automático vía Let's Encrypt) — ver [docs/deploy.md](docs/deploy.md) |
| **Desarrollo** | [Cloudflare Tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/) (túnel persistente para desarrollo) — ver la [sección Cloudflare Tunnel](#cloudflare-tunnel) |

<h2 id="estructura">📁 Estructura</h2>

```text
src/
├─ config/                    # Configuración de la aplicación y del entorno
├─ shared/                    # Errores, logger, validaciones y componentes compartidos
├─ infrastructure/            # Base de datos, Redis, colas, middlewares y OpenAPI
├─ interfaces/                # DTOs y rutas HTTP
├─ payments/                  # Abstracción e implementación de la pasarela de pago
├─ notifications/             # Abstracción e implementación del envío de correos
├─ wallet/                    # Ledger y gestión de saldo
├─ services/                  # Reglas de negocio compartidas por la API y el bot
├─ server/                    # Bootstrap de la API, rutas, middlewares y tareas programadas
└─ bot/                       # Dispatcher, sesiones, flujos e interfaces de Telegram

cloudflared/
└─ config.yml                 # Configuración del túnel de desarrollo

scripts/
├─ lib.*                      # Funciones compartidas
├─ start-dev.*                # Entorno de desarrollo
├─ start-tunnel.*             # Cloudflare Tunnel
└─ run-platform.js            # Compatibilidad entre Windows, Linux y macOS
```

<h2 id="rutas">📍 Rutas de la API</h2>

La API está organizada por módulos y documentada vía **Swagger/OpenAPI** en `GET /api/docs`.

Todas las rutas protegidas requieren un **Access Token JWT** enviado en el encabezado:

```http
Authorization: Bearer <accessToken>
```

**Rutas públicas:**

- `/health`
- `/api/health`
- `/api/docs`
- `/api/auth/*`
- `/email/verify/:token`
- `/api/webhooks/asaas`

> **Nota**
>
> Esta sección presenta los principales endpoints de la API. La documentación completa, con parámetros, ejemplos de solicitud y respuestas, está disponible en `GET /api/docs`.

### ❤️ Health & Documentación

| Método | Endpoint | Descripción |
|---|---|---|
| GET | `/health` | Verifica si la aplicación está en ejecución (*liveness*). |
| GET | `/api/health` | Verifica la disponibilidad de la aplicación, MySQL y Redis (*readiness*). |
| GET | `/api/docs` | Documentación interactiva de la API (Swagger/OpenAPI). |

---

### 🔐 Autenticación (`/api/auth`)

| Método | Endpoint | Descripción |
|---|---|---|
| POST | `/` | Autentica a un usuario del panel administrativo. |
| POST | `/refresh` | Genera un nuevo Access Token a partir de un Refresh Token válido. |
| POST | `/logout` | Revoca el Refresh Token actual. |
| POST | `/token` | Valida un Access Token (compatibilidad con el panel legado). |

---

### 👤 Usuarios (`/api/users`)

#### Usuarios del panel administrativo

| Método | Endpoint | Descripción |
|---|---|---|
| GET | `/` | Lista los usuarios del panel administrativo. |
| PATCH | `/update-user` | Actualiza los datos del usuario autenticado. |
| PATCH | `/update-pass` | Actualiza la contraseña del usuario autenticado. |

#### Usuarios del bot

| Método | Endpoint | Descripción |
|---|---|---|
| GET | `/users-bot/:search` | Busca usuarios por término libre. |
| POST | `/users-bot` | Busca usuarios usando filtros avanzados. |
| POST | `/user-bot` | Registra un nuevo usuario del bot. |
| GET | `/user-bot/:id` | Consulta un usuario del bot. |
| PATCH | `/user-bot` | Actualiza un usuario del bot. |
| DELETE | `/user-bot/:id` | Elimina un usuario del bot. |
| PUT | `/user-bot/:id/:status` | Activa o desactiva un usuario. |
| POST | `/transf-user-admin` | Aplica un ajuste manual de saldo con registro de auditoría. |

---

### 📊 Dashboard (`/api/dashboard`)

| Método | Endpoint | Descripción |
|---|---|---|
| GET | `/users` | Obtiene métricas de usuarios. |
| GET | `/balance/:user_id/:product_id/:period` | Consulta saldo y rendimiento por período. |
| GET | `/plans` | Lista los planes disponibles. |

---

### 🌐 Red de Afiliados (`/api/network`)

| Método | Endpoint | Descripción |
|---|---|---|
| POST | `/:id` | Consulta la estructura de afiliados de un usuario. |

---

### 💰 Solicitudes (`/api/requests`)

| Método | Endpoint | Descripción |
|---|---|---|
| GET | `/extract/:id` | Consulta el historial financiero de un usuario. |
| POST | `/extract/:id` | Consulta el historial financiero con filtros. |
| POST | `/withdrawal/:id` | Lista solicitudes de retiro. |
| POST | `/deposit/:id` | Lista solicitudes de depósito. |
| POST | `/subscription/:id` | Lista solicitudes de contratación de planes. |
| POST | `/support/:id` | Lista tickets de soporte. |
| POST | `/res-withdrawal` | Aprueba o rechaza una solicitud de retiro. |
| PATCH | `/was-read/:id/:status` | Marca un ticket de soporte como leído. |
| GET | `/pendencies` | Obtiene la cantidad de pendientes del sistema. |

---

### 🔗 Servicios Públicos

| Método | Endpoint | Descripción |
|---|---|---|
| GET | `/email/verify/:token` | Confirma la dirección de correo de un usuario. |
| POST | `/api/webhooks/asaas` | Recibe eventos de pagos y transferencias enviados por Asaas. |

<h2 id="primeros-pasos">▶️ Primeros Pasos</h2>

Esta sección explica cómo configurar el entorno de desarrollo local de **Smart Option Backend**.

### Requisitos

- Docker y Docker Compose
- Node.js **24+** (solo necesario para ejecutar la API directamente en el host)
- Token de un bot de Telegram creado con [BotFather](https://t.me/BotFather)
- Cuenta de Asaas Sandbox con clave de API
- Opcional: `cloudflared` instalado y autenticado, para recibir webhooks en local (ver la [sección Cloudflare Tunnel](#cloudflare-tunnel))

> **Recomendación**
>
> Usa un bot exclusivo para desarrollo y nunca reutilices el token del entorno de producción.

## Desarrollo con Docker (recomendado)

Clona el repositorio y configura el entorno:

```bash
git clone <url-del-repositorio>
cd smart-option

cp .env.development.example .env
```

Edita el archivo `.env` y configura, como mínimo:

- `SECRET_KEY`
- `JWT_REFRESH_SECRET`
- `BOT_TOKEN`
- `BOT_USER`
- `ASAAS_API_KEY`
- la configuración de correo (Resend o SMTP)

Para generar las claves:

**Linux/macOS**

```bash
openssl rand -hex 32
```

**Windows (PowerShell)**

```powershell
-join ((1..32 | % { '{0:x2}' -f (Get-Random -Min 0 -Max 256) }))
```

Después, simplemente ejecuta:

```bash
npm run dev:full
```

Este comando orquesta automáticamente todo el entorno de desarrollo:

- inicia MySQL, Redis y la API en contenedores Docker;
- habilita hot reload vía bind mount;
- espera a que todos los servicios estén disponibles;
- configura el Cloudflare Tunnel (cuando está instalado);
- valida los endpoints públicos que Asaas necesita;
- muestra la URL pública lista para registrar el webhook.

> **Nota**
>
> Si no usas el Cloudflare Tunnel, ejecuta solamente:
>
> ```bash
> npm run docker:up
> ```
>
> El bot sigue funcionando con normalidad vía Long Polling, pero los depósitos, contrataciones y retiros no se confirman automáticamente, ya que dependen de los webhooks de Asaas.

## Desarrollo sin Docker

También puedes ejecutar la API directamente en el host, manteniendo solo MySQL y Redis en contenedores.

```bash
git clone <url-del-repositorio>
cd smart-option

npm install

cp .env.development.example .env
```

Inicia la infraestructura:

```bash
npm run docker:up
```

Luego ejecuta:

```bash
npm run db:migrate
npm run db:seed

npm run dev
```

La API quedará disponible en:

```text
http://localhost:<APP_PORT>
```

Si quieres exponer la aplicación para recibir webhooks, ejecuta el túnel en otra terminal:

```bash
npm run tunnel
```

## Scripts Disponibles

| Script | Descripción |
|---|---|
| `npm run dev` | Ejecuta la API y el bot directamente en el host con hot reload. |
| `npm run dev:full` | Inicia todo el entorno Docker, configura el Cloudflare Tunnel y valida la infraestructura. |
| `npm run docker:up` | Inicia MySQL, Redis y la API en Docker. |
| `npm run docker:down` | Elimina los contenedores del entorno de desarrollo. |
| `npm run tunnel` | Inicia solo el Cloudflare Tunnel. |
| `npm run build` | Compila la aplicación para producción. |
| `npm start` | Ejecuta la versión compilada de la aplicación. |
| `npm test` | Ejecuta la suite de pruebas. |
| `npm run test:watch` | Ejecuta las pruebas en modo watch. |
| `npm run test:coverage` | Genera el reporte de cobertura de pruebas. |
| `npm run lint` | Analiza el código con ESLint. |
| `npm run lint:fix` | Corrige automáticamente los problemas encontrados por ESLint. |
| `npm run format` | Formatea el código usando Prettier. |
| `npm run format:check` | Verifica que el código esté correctamente formateado. |
| `npm run db:generate` | Genera migrations con Drizzle Kit. |
| `npm run db:migrate` | Aplica las migrations pendientes. |
| `npm run db:studio` | Abre Drizzle Studio. |
| `npm run db:seed` | Puebla la base de datos con los datos iniciales. |
| `npm run db:backfill-wallets` | Ejecuta el backfill del ledger de billeteras. |

<h2 id="configuracion-de-entornos">⚙️ Configuración de Entornos</h2>

La aplicación usa archivos `.env` para toda la configuración del entorno. No existe ninguna diferencia de comportamiento entre desarrollo y producción implementada en el código — la configuración depende exclusivamente de las variables de entorno.

Los archivos de ejemplo disponibles son:

| Archivo | Propósito | Uso |
|---|---|---|
| [.env.development.example](.env.development.example) | Desarrollo local (Docker, Cloudflare Tunnel y Asaas Sandbox) | Copiar a `.env` en tu máquina |
| [.env.production.example](.env.production.example) | Entorno de producción (Asaas Producción y Caddy) | Copiar a `.env` en la VPS |

Todas las variables que usa la aplicación están definidas en estos archivos y se validan al iniciar mediante `src/config/env.ts` con **Zod**.

Si falta alguna variable obligatoria o tiene un valor inválido, la aplicación interrumpe el arranque (*fail-fast*), mostrando un mensaje de error que indica exactamente cuál es el problema.

Las variables con un valor por defecto pueden omitirse; las que no lo tienen son obligatorias para que la aplicación funcione.

### Variables por Categoría

| Categoría | Variables Principales |
|---|---|
| **Aplicación** | `NODE_ENV`, `APP_PORT`, `API_BASE_PATH` |
| **Proxy reverso (producción)** | `DOMAIN`, `ACME_EMAIL` |
| **Base de datos** | `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_DATABASE` |
| **Redis** | `REDIS_URL`, `REDIS_PORT` |
| **Autenticación** | `SECRET_KEY`, `JWT_ACCESS_EXPIRES_IN`, `JWT_REFRESH_SECRET`, `JWT_REFRESH_EXPIRES_IN` |
| **Telegram** | `BOT_TOKEN`, `BOT_USER` |
| **Logging** | `LOG_LEVEL` |
| **CORS y Rate Limiting** | `CORS_ALLOWED_ORIGINS`, `RATE_LIMIT_WINDOW_MS`, `RATE_LIMIT_MAX` |
| **Asaas** | `ASAAS_ENV`, `ASAAS_API_KEY`, `ASAAS_BASE_URL`, `ASAAS_WEBHOOK_TOKEN` |
| **Cloudflare Tunnel** | `CF_TUNNEL_ID`, `CF_TUNNEL_TOKEN`, `CF_TUNNEL_DOMAIN`, `CF_TUNNEL_HOST` |
| **Correo** | `EMAIL_TYPE`, `RESEND_API_KEY`, `MAIL_FROM_NAME`, `MAIL_FROM_ADDRESS`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD` |

> **Importante**
>
> Los valores que comienzan con `$` (como `ASAAS_API_KEY`) deben ir entre comillas simples en el archivo `.env`:
>
> ```env
> ASAAS_API_KEY='$aact_...'
> ```
>
> Consulta la sección [Solución de Problemas](#solucion-de-problemas) para más detalles.

<h2 id="correos">📧 Correos</h2>

El envío de correos está centralizado en el módulo `src/notifications`, siguiendo el mismo patrón arquitectónico usado en `payments/`: la aplicación depende únicamente de la interfaz `EmailProvider`, mientras que la implementación se elige en tiempo de ejecución.

Toda la comunicación con proveedores de correo pasa por `notificationService`, encargado de operaciones como verificación de correo, recuperación de contraseña y notificaciones de depósito — manteniendo controllers, servicios y flujos del bot desacoplados de la tecnología usada.

```text
src/notifications/
├─ interfaces/     # Contratos de los proveedores de correo
├─ providers/      # Implementaciones (Resend y SMTP)
├─ templates/      # Plantillas reutilizables de correo
├─ factory/        # Selección del provider según EMAIL_TYPE
└─ services/       # Fachada consumida por el resto de la aplicación
```

### Proveedores Soportados

#### Resend (predeterminado)

Cuando `EMAIL_TYPE=resend` (valor predeterminado), la aplicación usa la API HTTP oficial de Resend.

El remitente se define mediante las variables:

```env
MAIL_FROM_NAME=Smart Option
MAIL_FROM_ADDRESS=smart-option@example.url
```

Lo que produce:

```text
From: Smart Option <smart-option@example.url>
```

Son obligatorias:

- `RESEND_API_KEY`
- `MAIL_FROM_NAME`
- `MAIL_FROM_ADDRESS`

#### SMTP

Cuando `EMAIL_TYPE=smtp`, la aplicación usa SMTP a través de Nodemailer, con soporte para TLS, timeout de conexión y reintento automático ante fallos transitorios.

Son obligatorias:

- `SMTP_HOST`
- `SMTP_USER`
- `SMTP_PASSWORD`

`SMTP_PORT` usa por defecto el puerto **465**.

### Cambiando de Proveedor

El cambio de proveedor se hace únicamente mediante la variable de entorno:

```env
EMAIL_TYPE=resend
```

o

```env
EMAIL_TYPE=smtp
```

No se necesita ningún otro cambio en el código.

### Agregando un Nuevo Proveedor

Para integrar un nuevo servicio (Amazon SES, Mailgun, Brevo, SendGrid, etc.) basta con:

1. implementar la interfaz `EmailProvider`;
2. registrar el nuevo provider en `email.factory.ts`;
3. agregar las variables necesarias al schema de `src/config/env.ts`.

Como toda la aplicación depende únicamente de la interfaz `EmailProvider`, no hace falta modificar ningún controller, service o flujo del bot.

<h2 id="cloudflare-tunnel">☁️ Cloudflare Tunnel</h2>

Durante el desarrollo, Asaas necesita acceder a la API para entregar los webhooks de confirmación de pagos. Para eso, el proyecto usa un **Cloudflare Tunnel** con dominio fijo, que permite recibir solicitudes públicas sin exponer puertos de la máquina local.

> El Cloudflare Tunnel se usa **solo en desarrollo**. En producción, la aplicación se publica a través de **Caddy** con HTTPS automático.

## Instalación

| Sistema | Comando |
|---|---|
| Windows (Chocolatey) | `choco install cloudflared` |
| Windows (Scoop) | `scoop install cloudflared` |
| macOS (Homebrew) | `brew install cloudflared` |
| Linux | https://pkg.cloudflare.com/index.html |
| Manual | https://github.com/cloudflare/cloudflared/releases |

Si `cloudflared` no está instalado, los comandos `npm run tunnel` y `npm run dev:full` muestran automáticamente estas instrucciones.

## Autenticación

Antes del primer uso, autentica la máquina con tu cuenta de Cloudflare:

```bash
cloudflared tunnel login
```

Se abrirá el navegador para autorizar el acceso al dominio usado por el proyecto.

Este paso solo se realiza una vez por máquina.

## Primera Ejecución

Después de autenticarte, simplemente ejecuta:

```bash
npm run dev:full
```

o

```bash
npm run tunnel
```

En la primera ejecución, el proyecto:

- crea un túnel persistente;
- registra automáticamente el DNS en Cloudflare;
- guarda el identificador del túnel en `.env`;
- reutiliza la misma configuración en las siguientes ejecuciones.

No se necesita ninguna configuración manual adicional.

## Configuración

El archivo:

```text
cloudflared/config.yml
```

se usa como plantilla.

Durante la ejecución, el proyecto genera automáticamente una configuración basada en las variables del `.env`, evitando duplicar información como dominio, puerto e identificador del túnel.

## Uso

Después de iniciar el entorno:

```bash
npm run dev:full
```

se mostrará un resumen similar a este:

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

Registra la **Webhook URL** mostrada en el panel **Sandbox** de Asaas.

Al detener la aplicación (`Ctrl + C`), el túnel también se detiene. Los contenedores Docker siguen ejecutándose hasta que los detengas con:

```bash
npm run docker:down
```

## Integración con Asaas

En el panel Sandbox de Asaas:

1. entra a **Integraciones → Webhooks**;
2. registra la URL indicada por `npm run dev:full`;
3. configura el mismo valor definido en `ASAAS_WEBHOOK_TOKEN`;
4. envía un evento de prueba y verifica el procesamiento en los logs de la aplicación.

## Cómo Funciona

`cloudflared` se ejecuta directamente en el host y reenvía las solicitudes a la API que corre en Docker, a través del puerto configurado en `APP_PORT`.

Este enfoque simplifica el entorno de desarrollo y evita tener que ejecutar un contenedor adicional solo para el túnel.

<h2 id="pruebas">🧪 Pruebas</h2>

El proyecto usa **Vitest** para pruebas unitarias y de integración.

### Ejecutando las Pruebas

| Comando | Descripción |
|---|---|
| `npm test` | Ejecuta toda la suite de pruebas. |
| `npm run test:watch` | Ejecuta las pruebas en modo *watch*, volviendo a correrlas automáticamente tras cada cambio. |
| `npm run test:coverage` | Ejecuta la suite completa y genera el reporte de cobertura de código. |

Las pruebas combinan:

- **Pruebas unitarias**, enfocadas en reglas de negocio aisladas;
- **Pruebas de integración**, usando **MySQL** y **Redis** reales ejecutados por `docker-compose.dev.yml`.

Los principales flujos cubiertos incluyen:

- autenticación y renovación de tokens JWT;
- movimientos del **WalletService**;
- procesamiento de pagos y webhooks;
- cálculo de comisiones de la red de afiliados.

> **Importante**
>
> Para ejecutar la suite completa de integración, los servicios **MySQL** y **Redis** deben estar en ejecución (`npm run docker:up` o `npm run dev:full`).

Las pruebas se ejecutan de forma secuencial (`fileParallelism: false`) para evitar conflictos de concurrencia en operaciones que comparten la misma base de datos.

<h2 id="despliegue">🚀 Despliegue</h2>

Esta guía describe el proceso de despliegue de **Smart Option Backend** (API + Bot de Telegram) en una VPS Linux usando Docker Compose y Caddy.

### Requisitos

- VPS Ubuntu/Debian
- acceso root o sudo
- dominio apuntado a la IP de la VPS (registro A)
- Docker Engine + Docker Compose

## 1. Instalar Docker

```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER

# Cierra sesión y vuelve a entrar para aplicar el grupo docker
docker --version
docker compose version
```

Abre los puertos **80** y **443** en el firewall:

```bash
ufw allow 80,443/tcp
```

> Solo Caddy queda expuesto a internet. La API, MySQL y Redis permanecen accesibles únicamente a través de la red interna de Docker Compose.

## 2. Clonar el Proyecto

```bash
git clone <url-del-repositorio> smart-option
cd smart-option

cp .env.production.example .env
```

Edita el archivo `.env` con los valores reales de producción.

### Configuraciones Obligatorias

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

Para generar las claves JWT:

```bash
openssl rand -hex 32
```

> **Importante**
>
> Los valores que comienzan con `$` (como `ASAAS_API_KEY`) deben ir entre comillas simples:
>
> ```env
> ASAAS_API_KEY='$aact_prod_...'
> ```
>
> De lo contrario, Docker Compose puede interpretar el valor como otra variable de entorno.

> `DB_HOST` y `REDIS_URL` no necesitan modificarse en producción — Docker Compose ya configura automáticamente esos valores para usar los servicios internos.

El archivo `.env` se monta directamente en el contenedor y debe permanecer en la raíz del proyecto.

## 3. Iniciar la Base de Datos y Redis

```bash
docker compose -f docker-compose.prod.yml up -d mysql redis

docker compose -f docker-compose.prod.yml ps
```

Espera a que ambos servicios muestren el estado **healthy**.

## 4. Ejecutar las Migrations

```bash
docker compose -f docker-compose.prod.yml --profile tools run --rm migrate
```

En el primer despliegue, ejecuta también:

```bash
docker compose -f docker-compose.prod.yml --profile tools run --rm migrate npm run db:seed
```

El seed inicial crea los productos predeterminados que usa el sistema.

## 5. Iniciar la Aplicación

```bash
docker compose -f docker-compose.prod.yml up -d --build

docker compose -f docker-compose.prod.yml ps
```

Caddy obtiene automáticamente un certificado TLS válido para el dominio configurado en `DOMAIN`.

Para seguir el proceso:

```bash
docker compose -f docker-compose.prod.yml logs -f caddy
```

Una vez emitido el certificado, valida la aplicación:

```bash
curl https://TU_DOMINIO/api/health
```

También conviene revisar los logs de la aplicación:

```bash
docker compose -f docker-compose.prod.yml logs -f app
```

### Renovación del Certificado

No se necesita ninguna configuración adicional.

Caddy renueva automáticamente los certificados de Let's Encrypt antes de que venzan, sin cron ni intervención manual.

## 6. Operación

### Logs

```bash
docker compose -f docker-compose.prod.yml logs -f app
docker compose -f docker-compose.prod.yml logs -f caddy
```

### Actualización

```bash
git pull

docker compose -f docker-compose.prod.yml up -d --build app
```

Si hay migrations nuevas, ejecuta de nuevo el paso **4** antes de levantar la nueva versión.

### Apagado

```bash
docker compose -f docker-compose.prod.yml stop app
```

La aplicación realiza un apagado ordenado: cierra la API, detiene el bot, finaliza el worker de webhooks y cierra las conexiones con la base de datos antes de terminar el proceso.

### Backup

```bash
docker compose -f docker-compose.prod.yml exec mysql \
mysqldump -u root -p"$DB_PASSWORD" "$DB_DATABASE" \
| gzip > backup-$(date +%F).sql.gz
```

Se recomienda almacenar los backups fuera de la VPS.

## 7. Limitaciones Conocidas

- El contenedor `app` no admite múltiples réplicas mientras el bot use **Long Polling**. Ejecutar dos instancias al mismo tiempo genera un error **409** de Telegram.

- Escalar horizontalmente requeriría separar la API y el bot en servicios independientes y migrar el bot a **webhooks** de Telegram.

- El despliegue no incluye pipeline de **CI/CD** — las actualizaciones se hacen manualmente.

- Caddy usa la imagen oficial, sin ningún módulo adicional de rate limiting. La protección contra abuso sigue a cargo de la propia aplicación, vía Redis.

<h2 id="seguridad">🔒 Seguridad</h2>

El modelo de seguridad de la aplicación está diseñado para proteger la autenticación, los movimientos financieros y la comunicación entre servicios.

- **Base de datos:** todas las consultas de negocio usan Drizzle ORM con queries parametrizadas, sin SQL concatenado a partir de entradas externas.
- **Contraseñas:** almacenadas con **bcrypt** (costo 12). Los hashes heredados en **SHA-1** se migran automáticamente a bcrypt en el primer login (*lazy migration*).
- **Autenticación:** access tokens JWT de corta duración combinados con **refresh tokens rotativos**, con detección de reutilización y revocación automática de toda la familia de tokens.
- **Rate limiting:** límites globales y específicos para autenticación almacenados en Redis, manteniendo un comportamiento consistente incluso con múltiples instancias de la aplicación.
- **Webhooks:** validación de firma mediante comparación en tiempo constante (*constant-time comparison*), protegiendo contra ataques de timing.
- **Seguridad HTTP:** Helmet, política de CORS basada en *allowlist* y `trust proxy` configurado exclusivamente para el proxy reverso de la infraestructura.
- **Infraestructura:** solo Caddy expone los puertos **80** y **443** en producción. La API, MySQL y Redis permanecen aislados en la red interna de Docker Compose, con TLS emitido y renovado automáticamente por Let's Encrypt.
- **Secretos:** todas las credenciales provienen exclusivamente de variables de entorno, sin ninguna información sensible en el código fuente.

<h2 id="solucion-de-problemas">🛠️ Solución de Problemas</h2>

### No se encuentra `cloudflared` en el `PATH`

El Cloudflare Tunnel no está instalado o no está disponible en el `PATH`.

Consulta la [sección Cloudflare Tunnel](#cloudflare-tunnel) para instalarlo.

---

### `cloudflared` está instalado, pero la máquina no está autenticada

Ejecuta:

```bash
cloudflared tunnel login
```

Se abrirá el navegador para autenticarte. Selecciona la cuenta y la zona del dominio usado por el proyecto.

---

### `ASAAS_API_KEY` parece inválida dentro de Docker

Si la aplicación reporta una **"clave inválida"** aun con la variable bien configurada, verifica que esté entre comillas simples.

```env
ASAAS_API_KEY='$aact_hmlg_...'
```

Como las claves de Asaas comienzan con `$`, Docker Compose puede interpretar ese carácter como una variable de entorno al leer el `.env`.

---

### MySQL o Redis permanecen como `unhealthy`

Revisa los logs de los servicios:

```bash
docker compose -f docker-compose.dev.yml logs mysql redis
```

En el primer arranque, MySQL puede tardar unos segundos adicionales en completar su proceso de bootstrap.

---

### Error `EADDRINUSE`

Otra instancia de la API ya está usando el puerto configurado en `APP_PORT`.

Detén la instancia anterior:

```bash
npm run docker:down
```

o finaliza manualmente el proceso responsable del puerto.

> `npm run dev:full` reutiliza automáticamente una API ya disponible siempre que puede.

---

### Error 409 de Telegram

```
terminated by other getUpdates request
```

El bot usa **Long Polling**, que solo permite una instancia usando el mismo `BOT_TOKEN`.

Asegúrate de que no haya otra aplicación (desarrollo o producción) corriendo al mismo tiempo con el mismo token.

---

### El registro DNS del túnel no se crea

Verifica que la cuenta autenticada tenga acceso a la zona del dominio usado por el proyecto:

```bash
cloudflared tunnel login
```

Si el registro no se crea automáticamente, puedes agregarlo manualmente desde el panel de Cloudflare.

<h2 id="licencia">📄 Licencia</h2>

Este proyecto se distribuye bajo la **Smart Option Source Available License (SSAL)**.

Se permite:

- estudiar el código fuente;
- realizar un fork del repositorio con fines educativos;
- utilizar partes de la implementación como referencia de aprendizaje.

No está permitido:

- utilizar este proyecto con fines comerciales;
- ofrecerlo como producto o servicio;
- crear plataformas de inversión, marketing multinivel (MLM), HYIP, esquemas Ponzi, pirámides financieras, apuestas o cualquier otro servicio financiero similar utilizando este código.

Consulta el archivo [LICENSE](LICENSE) para conocer los términos completos de la licencia.

<h2 id="related-projects">🔗 Proyectos Relacionados</h2>

| Proyecto | Descripción | Repositorio |
|----------|-----------|-------------|
| 👑 Panel Admin (Frontend) | Interfaz administrativa para gestionar la plataforma Smart Option. | https://github.com/issagomesdev/smart-option-admin |
