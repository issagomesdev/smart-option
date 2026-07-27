<p align="center">
  <a href="./README.md">🇺🇸 English</a> |
  <a href="./README.pt-BR.md">🇧🇷 Português</a> |
  <b>🇪🇸 Español</b>
</p>

# 🤖 Smart Option — Backend (API + Bot de Telegram)

![Node.js](https://img.shields.io/badge/Node.js-24.x-green?style=for-the-badge&logo=node.js&logoColor=white) ![TypeScript](https://img.shields.io/badge/TypeScript-5.9-%23007ACC.svg?style=for-the-badge&logo=typescript&logoColor=white) ![Express.js](https://img.shields.io/badge/Express.js-4.x-%23404d59.svg?style=for-the-badge&logo=express&logoColor=white) ![Telegram](https://img.shields.io/badge/Telegram-Bot-2CA5E0?style=for-the-badge&logo=telegram&logoColor=white) ![Asaas](https://img.shields.io/badge/Asaas-PIX%20Gateway-00D084?style=for-the-badge) ![Drizzle](https://img.shields.io/badge/Drizzle-ORM-C5F74F?style=for-the-badge) ![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?style=for-the-badge&logo=docker&logoColor=white)

<p align="center">
  <a href="#acerca">Acerca del proyecto</a> •
  <a href="#arquitectura">Arquitectura</a> •
  <a href="#funcionalidades">Funcionalidades</a> •
  <a href="#stack">Stack</a> •
  <a href="#estructura">Estructura</a> •
  <a href="#rutas">Rutas</a> •
  <a href="#primeros-pasos">Primeros pasos</a> •
  <a href="#configuracion">Configuración</a> •
  <a href="#correos">Correos</a> •
  <a href="#cloudflare-tunnel">Cloudflare Tunnel</a> •
  <a href="#modo-demo">Modo Demostración</a> •
  <a href="#pruebas">Pruebas</a> •
  <a href="#despliegue">Despliegue</a> •
  <a href="#seguridad">Seguridad</a> •
  <a href="#solucion-de-problemas">Solución de problemas</a> •
  <a href="#licencia">Licencia</a> •
  <a href="#proyectos-relacionados">Proyectos relacionados</a>
</p>

> ⚠️ **Aviso:** **Smart Option** es un proyecto de demostración publicado exclusivamente con fines de **estudio**, **aprendizaje** y **portafolio**. Originalmente desarrollado para atender los requerimientos de un proyecto freelance real que nunca llegó a producción, luego evolucionó como caso de estudio para mostrar arquitectura de software, integraciones financieras, automatización y buenas prácticas de ingeniería. **Bajo ninguna circunstancia debe usarse, adaptarse o interpretarse como una herramienta para obtener ganancias financieras reales ni para operaciones de inversión.**

<h2 id="acerca">📌 Acerca del proyecto</h2>

**Smart Option** es una **plataforma de inversiones automatizadas** que combina la practicidad de un **bot de Telegram** con un **panel administrativo** dedicado a la gestión de la operación. Integrada con **PIX** a través de **Asaas**, la plataforma permite que los usuarios realicen **depósitos**, adquieran **planes de rendimiento**, hagan seguimiento de sus **rendimientos** y **movimientos financieros**, gestionen una **red de afiliados** con hasta **tres niveles de comisión** y soliciten **retiros**, todo de forma simple, rápida y sin salir de **Telegram**.

Este repositorio contiene el **backend** de **Smart Option**, responsable de toda la **lógica de negocio** de la plataforma. Además de exponer la **API REST** que consume el panel administrativo, la aplicación gestiona el funcionamiento del **bot de Telegram**, la autenticación, las integraciones financieras, el procesamiento de transacciones, las reglas de rentabilidad, el sistema de afiliados, las notificaciones y demás procesos internos. Desarrollado con **Node.js** y **TypeScript**, utiliza **MySQL** con **Drizzle ORM** para la persistencia de datos, **Redis** para caché y manejo de sesiones, y **BullMQ** para el procesamiento asíncrono de tareas, conformando una arquitectura moderna, escalable y lista para entornos de producción.

<h2 id="arquitectura">🏗️ Arquitectura</h2>

**Smart Option** fue diseñado siguiendo los principios de **Clean Architecture**, separando responsabilidades en módulos independientes para facilitar la evolución, las pruebas y el mantenimiento. La aplicación organiza la lógica de negocio, la infraestructura y las interfaces de forma desacoplada, lo que permite sustituir integraciones externas sin afectar las reglas del dominio.

```text
config/          → Configuración, variables de entorno y modo demostración
shared/          → Componentes compartidos (errores, logger, validaciones, caché, seguridad)
infrastructure/  → Base de datos, Redis, BullMQ, OpenAPI e infraestructura HTTP
interfaces/      → DTOs, validaciones y rutas HTTP
payments/        → Integración con pasarelas de pago
notifications/   → Sistema de envío de correos
wallet/          → Control centralizado de los movimientos financieros
services/        → Reglas de negocio de la plataforma
server/          → Bootstrap de la aplicación, middlewares, cron jobs y programadores
bot/             → Flujos, sesiones e interacción con Telegram
```

### Principales decisiones de arquitectura

Se tomaron algunas decisiones para hacer la aplicación más segura, desacoplada y preparada para evolucionar.

- **WalletService** centraliza todos los movimientos financieros de la plataforma. Ningún otro módulo modifica saldos directamente, lo que garantiza consistencia, trazabilidad e idempotencia.

- El módulo **payments** depende únicamente de la interfaz `PaymentProvider`, lo que permite reemplazar la pasarela actual (**Asaas**) por cualquier otra sin tocar las reglas de negocio.

- El módulo **notifications** sigue el mismo principio mediante la interfaz `EmailProvider`, permitiendo alternar entre **Resend**, **SMTP** o un proveedor específico para el modo demostración solo por configuración.

- Los **webhooks de Asaas** se procesan de forma asíncrona con **BullMQ**, lo que mejora el rendimiento y aporta reintentos automáticos y deduplicación de eventos.

- El **modo demostración** tiene una única fuente de configuración (`config/demo.ts`), encargada de habilitar los recursos exclusivos de la demostración y bloquear operaciones irreversibles sin afectar al resto de la aplicación.

- El **catálogo de planes** es totalmente administrable desde el panel, mientras que los planes predeterminados del sistema permanecen protegidos para preservar reglas críticas de negocio.

- El **bot de Telegram** mantiene sesiones individuales en **Redis** y utiliza un único dispatcher para controlar todos los flujos de conversación, lo que hace la navegación predecible y el mantenimiento más simple.

- Los **seeders** permanecen desacoplados de los comandos que los ejecutan. El mismo catálogo de planes se reutiliza en la creación inicial del sistema, en la actualización manual de los planes y en la restauración del entorno de demostración, evitando duplicación de datos y garantizando una única fuente de verdad.

<h2 id="funcionalidades">✨ Funcionalidades</h2>

Las funcionalidades están organizadas según los dos módulos que componen Smart Option: el **bot de Telegram**, orientado a la experiencia del usuario final, y la **API del panel administrativo**, orientada a la gestión y operación de la plataforma.

### 🤖 Bot de Telegram

El bot reúne todo el recorrido del usuario en una sola interfaz:

- Registro completo con validación de **CPF**, dirección, clave **PIX** y verificación de correo electrónico.
- Autenticación segura con sesiones aisladas por usuario.
- Depósitos vía **PIX** usando **Asaas**, con código QR, código para copiar y pegar y confirmación automática por webhook.
- Contratación de **planes automáticos** directamente desde el bot.
- Solicitud de **planes manuales**, enviadas al equipo administrativo para su análisis.
- Solicitud de retiros vía **PIX**, sujetos a aprobación administrativa.
- Transferencias internas entre usuarios utilizando el correo electrónico como identificador.
- Consulta de saldo, estado de cuenta, rendimientos e historial completo de movimientos.
- Gestión de una **red de afiliados** con hasta **tres niveles de comisión**.
- Procesamiento automático de la rentabilidad según el plan contratado.
- Canal de soporte integrado para la atención al usuario.

### 🌐 API del Panel Administrativo

La API expone todo lo necesario para operar la plataforma desde el panel administrativo:

- Autenticación basada en **JWT**, con refresh tokens rotativos y protección contra reutilización.
- Protección contra abuso mediante **rate limiting** distribuido con Redis.
- Dashboard administrativo con **KPIs**, gráficos, comparativas por período e indicadores consolidados de la plataforma.
- Gestión completa de usuarios, incluyendo consultas, filtros, auditoría y ajustes administrativos.
- Aprobación y gestión de depósitos, retiros, suscripciones y solicitudes financieras.
- Auditoría financiera completa, con trazabilidad de todos los movimientos de la plataforma.
- Gestión de la estructura de afiliados y seguimiento de la red de cada usuario.
- Administración completa del catálogo de planes (**AUTO** y **MANUAL**), con protección para los recursos críticos del sistema.
- **Modo demostración** opcional, con inicio de sesión como visitante, bloqueo de operaciones irreversibles y restauración automática del entorno.
- Documentación interactiva de la API mediante **Swagger/OpenAPI**.

### ⚙️ Aspectos destacados de la plataforma

Además de las funcionalidades principales, el proyecto incluye:

- Arquitectura basada en **Clean Architecture** y principios **SOLID**.
- Procesamiento asíncrono con **BullMQ**.
- Caché distribuida y manejo de sesiones con **Redis**.
- Integración financiera vía **Asaas**.
- Sistema de permisos basado en **RBAC**.
- Auditoría completa de las operaciones financieras.
- Un entorno de demostración independiente de producción.
- Documentación técnica y API versionada.

<h2 id="stack">🛠️ Stack</h2>

| Categoría | Tecnologías |
|---|---|
| **Lenguaje y Runtime** | Node.js 24, TypeScript 5.9 |
| **API y HTTP** | Express 4, Helmet, CORS (allowlist), `express-rate-limit` (Redis store) |
| **Base de datos** | MySQL 8.4, **Drizzle ORM**, `drizzle-kit` |
| **Caché y colas** | Redis 7, BullMQ |
| **Bot** | `node-telegram-bot-api` |
| **Pagos** | Asaas (PIX, transferencias y webhooks) |
| **Autenticación** | JWT (`jsonwebtoken`), `bcryptjs` |
| **Validación** | Zod |
| **Logs y observabilidad** | Pino, `pino-http`, `x-request-id` |
| **Pruebas** | Vitest, Supertest |
| **Infraestructura** | Docker (multi-stage), Docker Compose, Caddy (TLS automático vía Let's Encrypt) |

Durante el desarrollo, el proyecto utiliza algunas herramientas para simplificar la configuración del entorno y permitir integraciones externas sin exponer directamente la máquina local.

| Herramienta | Finalidad |
|---|---|
| **Cloudflare Tunnel** | Exposición segura del entorno local para probar webhooks e integraciones externas. |
| **Docker Compose** | Orquestación de los servicios de desarrollo. |
| **Swagger / OpenAPI** | Documentación y pruebas de la API REST. |

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
├─ services/                  # Reglas de negocio consumidas por la API y el bot
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

La API está organizada por módulos y documentada con **Swagger/OpenAPI** en `/api/docs`.

Todas las rutas protegidas requieren un **Access Token JWT** enviado en la cabecera:

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
> Esta sección presenta los principales endpoints de la API. La documentación completa, con parámetros, ejemplos de petición y respuestas, está disponible en `GET /api/docs`.

### ❤️ Health y documentación

| Método | Endpoint | Descripción |
|---|---|---|
| GET | `/health` | Verifica si la aplicación está en ejecución (*liveness*). |
| GET | `/api/health` | Verifica la disponibilidad de la aplicación, MySQL y Redis (*readiness*). |
| GET | `/api/docs` | Documentación interactiva de la API (Swagger/OpenAPI). |

---

### 🔐 Autenticación (`/api/auth`)

Se encarga de la autenticación del panel administrativo, la gestión de sesiones, la renovación de tokens y el acceso al modo demostración.

| Método | Endpoint | Descripción |
|---|---|---|
| POST | `/` | Autentica a un administrador. |
| POST | `/demo-login` | Crea una sesión temporal de demostración, sin necesidad de credenciales. Disponible solo con `APP_DEMO=true`. |
| POST | `/refresh` | Genera un nuevo Access Token a partir de un Refresh Token válido. |
| POST | `/logout` | Revoca el Refresh Token de la sesión actual. |
| POST | `/token` | Valida un Access Token e indica si la sesión está en modo demostración. |

---

### 👤 Usuarios (`/api/users`)

Gestión de los administradores del panel y de los usuarios registrados desde el bot de Telegram.

#### Administradores

| Método | Endpoint | Descripción |
|---|---|---|
| GET | `/` | Lista los administradores registrados. |
| PATCH | `/update-user` | Actualiza los datos del administrador autenticado. |
| PATCH | `/update-pass` | Cambia la contraseña del administrador autenticado. |

#### Usuarios del bot

| Método | Endpoint | Descripción |
|---|---|---|
| GET | `/users-bot/:search` | Busca usuarios por término libre. |
| POST | `/users-bot` | Busca usuarios con filtros avanzados. |
| POST | `/user-bot` | Crea un nuevo usuario. |
| GET | `/user-bot/:id` | Consulta los datos de un usuario. |
| PATCH | `/user-bot` | Actualiza los datos de un usuario. |
| DELETE | `/user-bot/:id` | Elimina un usuario. |
| PUT | `/user-bot/:id/:status` | Activa o desactiva un usuario. |
| POST | `/transf-user-admin` | Realiza un ajuste manual de saldo con registro en auditoría. |

---

### 📊 Dashboard (`/api/dashboard`)

Endpoints responsables de los indicadores estratégicos que muestra el panel administrativo.

| Método | Endpoint | Descripción |
|---|---|---|
| GET | `/summary` | Devuelve los principales indicadores del dashboard, incluyendo KPIs, gráficos, aprobaciones del día y movimientos recientes, con filtros por período y caché en Redis. |
| GET | `/plans` | Lista los planes disponibles para mostrar en el dashboard. |

---

### 📦 Planes (`/api/plans`)

Gestión completa del catálogo de planes de la plataforma.

| Método | Endpoint | Descripción |
|---|---|---|
| GET | `/` | Lista los planes con paginación, filtros y ordenamiento. |
| GET | `/:id` | Consulta los datos de un plan. |
| POST | `/` | Crea un nuevo plan. |
| PATCH | `/:id` | Actualiza un plan existente. |
| DELETE | `/:id` | Elimina un plan. Los planes del sistema o con suscriptores activos no pueden eliminarse. |

---

### 🔍 Auditoría Financiera (`/api/audit`)

Consulta completa y auditable de todos los movimientos financieros de la plataforma.

| Método | Endpoint | Descripción |
|---|---|---|
| POST | `/` | Devuelve el historial consolidado de movimientos financieros, con filtros, paginación, ordenamiento y búsqueda avanzada. |

---

### 🌐 Red de Afiliados (`/api/network`)

Consulta de la estructura jerárquica de afiliados vinculada a los usuarios.

| Método | Endpoint | Descripción |
|---|---|---|
| POST | `/:id` | Devuelve la estructura completa de la red de afiliados de un usuario. |

---

### 💰 Solicitudes (`/api/requests`)

Gestión de depósitos, retiros, suscripciones, soporte y demás solicitudes operativas de la plataforma.

| Método | Endpoint | Descripción |
|---|---|---|
| GET | `/extract/:id` | Consulta el estado de cuenta de un usuario. |
| POST | `/extract/:id` | Consulta el estado de cuenta con filtros avanzados. |
| POST | `/withdrawal/:id` | Lista las solicitudes de retiro. |
| POST | `/deposit/:id` | Lista los depósitos realizados. |
| POST | `/subscription/:id` | Lista las solicitudes de suscripción a planes. |
| POST | `/support/:id` | Lista los tickets de soporte. |
| POST | `/res-withdrawal` | Aprueba o rechaza una solicitud de retiro. |
| PATCH | `/was-read/:id/:status` | Actualiza el estado de lectura de un ticket. |
| GET | `/pendencies` | Devuelve el total de pendientes operativos de la plataforma. |

---

### 🔗 Integraciones y endpoints públicos

Endpoints utilizados por integraciones externas y recursos accesibles sin autenticación.

| Método | Endpoint | Descripción |
|---|---|---|
| GET | `/email/verify/:token` | Confirma la dirección de correo electrónico de un usuario. |
| POST | `/api/webhooks/asaas` | Recibe los eventos que envía Asaas sobre pagos, cobros y transferencias vía PIX. |

<h2 id="primeros-pasos">▶️ Primeros pasos</h2>

Esta sección describe cómo configurar el entorno de desarrollo local de **Smart Option**.

### Requisitos

- Docker y Docker Compose
- Node.js **24+** (solo necesario para ejecutar la API directamente en el host)
- Token de un bot de Telegram creado con [BotFather](https://t.me/BotFather)
- Cuenta de Asaas Sandbox con clave de API
- Opcional: `cloudflared` instalado y autenticado para recibir webhooks localmente (ver la [sección Cloudflare Tunnel](#cloudflare-tunnel))

### Desarrollo con Docker (recomendado)

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

Después basta con ejecutar:

```bash
npm run dev:full
```

Este comando orquesta automáticamente todo el entorno de desarrollo:

- inicia MySQL, Redis y la API en contenedores Docker;
- aplica hot reload mediante bind mount;
- espera a que todos los servicios estén disponibles;
- configura el Cloudflare Tunnel (cuando está instalado);
- valida los endpoints públicos que usa Asaas;
- muestra la URL pública lista para registrar el webhook.

> **Nota**
>
> Si no usas Cloudflare Tunnel, ejecuta solo:
>
> ```bash
> npm run docker:up
> ```
>
> El bot sigue funcionando normalmente mediante long polling, pero los depósitos, suscripciones y retiros no se confirman automáticamente, ya que dependen de los webhooks de Asaas.

### Desarrollo sin Docker

También es posible ejecutar la API directamente en el host, manteniendo solo MySQL y Redis en contenedores.

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

La API estará disponible en:

```text
http://localhost:<APP_PORT>
```

Si quieres exponer la aplicación para recibir webhooks, ejecuta el túnel en otra terminal:

```bash
npm run tunnel
```

### Scripts disponibles

| Script | Descripción |
|---|---|
| `npm run dev` | Ejecuta la API y el bot directamente en el host con hot reload. |
| `npm run dev:full` | Inicia todo el entorno Docker, configura el Cloudflare Tunnel y valida la infraestructura. |
| `npm run docker:up` | Inicia MySQL, Redis y la API en Docker. |
| `npm run docker:down` | Elimina los contenedores del entorno de desarrollo. |
| `npm run tunnel` | Inicia únicamente el Cloudflare Tunnel. |
| `npm run build` | Compila la aplicación para producción. |
| `npm start` | Ejecuta la versión compilada de la aplicación. |
| `npm test` | Ejecuta la suite de pruebas. |
| `npm run test:watch` | Ejecuta las pruebas en modo watch. |
| `npm run test:coverage` | Genera el reporte de cobertura de pruebas. |
| `npm run lint` | Analiza el código con ESLint. |
| `npm run lint:fix` | Corrige automáticamente los problemas detectados por ESLint. |
| `npm run format` | Formatea el código con Prettier. |
| `npm run format:check` | Verifica que el código esté correctamente formateado. |
| `npm run db:generate` | Genera migraciones con Drizzle Kit. |
| `npm run db:migrate` | Aplica las migraciones pendientes. |
| `npm run db:studio` | Abre Drizzle Studio. |
| `npm run db:seed` | Puebla la base de datos con los datos iniciales (catálogo de planes + cuenta admin). |
| `npm run db:backfill-wallets` | Reconstruye el ledger de billeteras a partir del historial de saldos anterior. |
| `npm run plans:seed` | Garantiza el catálogo de planes predeterminado (idempotente, independiente del modo demostración). |
| `npm run demo:seed` | Limpia y regenera los datos de demostración (**destructivo** — equivalente a `demo:reset`). Requiere `APP_DEMO=true`. |
| `npm run demo:reset` | Restaura el entorno de demostración a su estado inicial (**destructivo**). Requiere `APP_DEMO=true`. |

<h2 id="configuracion">⚙️ Configuración</h2>

La aplicación usa archivos `.env` para toda la configuración del entorno. No hay diferencias de comportamiento entre desarrollo y producción en el código: todo se define mediante variables de entorno.

Los archivos de ejemplo disponibles son:

| Archivo | Finalidad | Uso |
|---|---|---|
| [.env.development.example](.env.development.example) | Desarrollo local (Docker, Cloudflare Tunnel y Asaas Sandbox) | Cópialo a `.env` en tu máquina |
| [.env.production.example](.env.production.example) | Entorno de producción (Asaas Producción y Caddy) | Cópialo a `.env` en el VPS |

Todas las variables que usa la aplicación están definidas en esos archivos y se validan al iniciar mediante `src/config/env.ts` con **Zod**.

Si falta alguna variable obligatoria o tiene un valor inválido, la aplicación detiene el arranque (*fail-fast*) mostrando un mensaje de error que indica exactamente el problema.

Las variables con valor por defecto pueden omitirse; las que no lo tienen son obligatorias para el funcionamiento de la aplicación.

### Variables por categoría

| Categoría | Principales variables |
|---|---|
| **Aplicación** | `NODE_ENV`, `APP_PORT`, `API_BASE_PATH` |
| **Proxy inverso (producción)** | `DOMAIN`, `ACME_EMAIL` |
| **Base de datos** | `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_DATABASE` |
| **Redis** | `REDIS_URL`, `REDIS_PORT` |
| **Autenticación** | `SECRET_KEY`, `JWT_ACCESS_EXPIRES_IN`, `JWT_REFRESH_SECRET`, `JWT_REFRESH_EXPIRES_IN` |
| **Telegram** | `BOT_TOKEN`, `BOT_USER` |
| **Logging** | `LOG_LEVEL` |
| **CORS y rate limiting** | `CORS_ALLOWED_ORIGINS`, `RATE_LIMIT_WINDOW_MS`, `RATE_LIMIT_MAX` |
| **Asaas** | `ASAAS_ENV`, `ASAAS_API_KEY`, `ASAAS_BASE_URL`, `ASAAS_WEBHOOK_TOKEN` |
| **Cloudflare Tunnel** | `CF_TUNNEL_ID`, `CF_TUNNEL_TOKEN`, `CF_TUNNEL_DOMAIN`, `CF_TUNNEL_HOST` |
| **Correo** | `EMAIL_TYPE`, `RESEND_API_KEY`, `MAIL_FROM_NAME`, `MAIL_FROM_ADDRESS`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD` |
| **Modo demostración** | `APP_DEMO`, `AUTO_RESET`, `AUTO_RESET_INTERVAL` |

> **Importante**
>
> Los valores que empiezan con `$` (como `ASAAS_API_KEY`) deben ir entre comillas simples en el archivo `.env`:
>
> ```env
> ASAAS_API_KEY='$aact_...'
> ```
>
> Consulta la sección [Solución de problemas](#solucion-de-problemas) para más detalles.

<h2 id="correos">📧 Correos</h2>

El envío de correos está centralizado en el módulo `src/notifications` y sigue el mismo patrón arquitectónico que `payments/`: la aplicación depende únicamente de la interfaz `EmailProvider`, mientras que la implementación se elige en tiempo de ejecución.

Toda la comunicación con los proveedores de correo pasa por `notificationService`, responsable de operaciones como la verificación de correo, la recuperación de contraseña y las notificaciones de depósito, manteniendo controllers, servicios y flujos del bot desacoplados de la tecnología utilizada.

```text
src/notifications/
├─ interfaces/     # Contratos de los proveedores de correo
├─ providers/      # Implementaciones (Resend y SMTP)
├─ templates/      # Plantillas reutilizables de correo
├─ factory/        # Selección del proveedor según EMAIL_TYPE
└─ services/       # Fachada consumida por el resto de la aplicación
```

### Proveedores soportados

#### Resend (predeterminado)

Con `EMAIL_TYPE=resend` (valor por defecto), la aplicación usa la API HTTP oficial de Resend.

El remitente se define con:

```env
MAIL_FROM_NAME=Smart Option
MAIL_FROM_ADDRESS=smart-option@example.url
```

Lo que resulta en:

```text
From: Smart Option <smart-option@example.url>
```

Variables obligatorias:

- `RESEND_API_KEY`
- `MAIL_FROM_NAME`
- `MAIL_FROM_ADDRESS`

#### SMTP

Con `EMAIL_TYPE=smtp`, la aplicación usa SMTP a través de Nodemailer, con soporte para TLS, timeout de conexión y reintento automático ante fallos transitorios.

Variables obligatorias:

- `SMTP_HOST`
- `SMTP_USER`
- `SMTP_PASSWORD`

`SMTP_PORT` usa por defecto el puerto **465**.

### Cambiar de proveedor

El cambio de proveedor se hace únicamente con la variable de entorno:

```env
EMAIL_TYPE=resend
```

o

```env
EMAIL_TYPE=smtp
```

No se requiere ningún otro cambio en el código.

### Agregar un nuevo proveedor

Para integrar un nuevo servicio (Amazon SES, Mailgun, Brevo, SendGrid, etc.):

1. implementa la interfaz `EmailProvider`;
2. registra el nuevo proveedor en `email.factory.ts`;
3. agrega las variables necesarias al esquema de `src/config/env.ts`.

Como toda la aplicación depende únicamente de la interfaz `EmailProvider`, ningún controller, servicio o flujo del bot necesita modificarse.

<h2 id="cloudflare-tunnel">☁️ Cloudflare Tunnel</h2>

Durante el desarrollo, Asaas necesita acceder a la API para entregar los webhooks de confirmación de pagos. Para eso, el proyecto usa un **Cloudflare Tunnel** con dominio fijo, lo que permite recibir peticiones públicas sin exponer puertos de la máquina local.

> El Cloudflare Tunnel se usa **solo en desarrollo**. En producción, la aplicación se publica normalmente mediante **Caddy** con HTTPS automático.

### Instalación

| Sistema | Comando |
|---|---|
| Windows (Chocolatey) | `choco install cloudflared` |
| Windows (Scoop) | `scoop install cloudflared` |
| macOS (Homebrew) | `brew install cloudflared` |
| Linux | https://pkg.cloudflare.com/index.html |
| Manual | https://github.com/cloudflare/cloudflared/releases |

Si `cloudflared` no está instalado, los comandos `npm run tunnel` y `npm run dev:full` muestran estas instrucciones automáticamente.

### Autenticación

Antes del primer uso, autentica la máquina en tu cuenta de Cloudflare:

```bash
cloudflared tunnel login
```

Se abrirá el navegador para autorizar el acceso al dominio que usa el proyecto.

Este procedimiento se realiza una sola vez por máquina.

### Primera ejecución

Después de autenticar, basta con ejecutar:

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
- guarda el identificador del túnel en el `.env`;
- reutiliza la misma configuración en las siguientes ejecuciones.

No se requiere ninguna configuración manual adicional.

### Configuración

El archivo:

```text
cloudflared/config.yml
```

se usa como plantilla.

Durante la ejecución, el proyecto genera automáticamente una configuración a partir de las variables del `.env`, evitando duplicar información como el dominio, el puerto y el identificador del túnel.

### Uso

Después de iniciar el entorno:

```bash
npm run dev:full
```

verás un resumen parecido a este:

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

Registra la **Webhook URL** que aparece en el panel **Sandbox** de Asaas.

Al detener la aplicación (`Ctrl + C`), el túnel también se cierra. Los contenedores Docker siguen en ejecución hasta que los detengas con:

```bash
npm run docker:down
```

### Integración con Asaas

En el panel Sandbox de Asaas:

1. entra en **Integraciones → Webhooks**;
2. registra la URL que muestra `npm run dev:full`;
3. configura el mismo valor definido en `ASAAS_WEBHOOK_TOKEN`;
4. envía un evento de prueba y sigue el procesamiento en los logs de la aplicación.

### Cómo funciona

`cloudflared` se ejecuta directamente en el host y reenvía las peticiones a la API que corre en Docker, a través del puerto configurado en `APP_PORT`.

Este enfoque simplifica el entorno de desarrollo y evita levantar un contenedor adicional solo para el túnel.

<h2 id="modo-demo">🎭 Modo Demostración</h2>

El **modo demostración** convierte a Smart Option en un entorno público de demostración, permitiendo que cualquier visitante explore prácticamente todas las funcionalidades del sistema sin comprometer la seguridad de la aplicación ni realizar operaciones reales.

Todo el entorno fue diseñado para ofrecer una experiencia cercana a producción, con datos realistas, pero impidiendo cualquier acción que pueda afectar sistemas externos, información crítica o movimientos financieros.

> ⚠️ **Todo el comportamiento descrito en esta sección se controla con la variable `APP_DEMO`.** Con `APP_DEMO=false` (valor por defecto), no se habilita ninguna funcionalidad de demostración: la ruta de inicio de sesión como visitante no existe, los bloqueos permanecen inactivos y cualquier intento de ejecutar comandos de reset se interrumpe de inmediato.

### Variables de entorno

| Variable | Por defecto | Descripción |
|---|---|---|
| `APP_DEMO` | `false` | Habilita el modo demostración, incluyendo el inicio de sesión como visitante, el bloqueo de operaciones críticas y los comandos de restauración del entorno. |
| `AUTO_RESET` | `false` | Habilita la restauración automática del entorno. **Requiere `APP_DEMO=true`**. El servidor detiene el arranque si la combinación es inválida. |
| `AUTO_RESET_INTERVAL` | *60* | Intervalo del reset automático en **minutos** (`60`, `1440`, etc.). Obligatorio cuando `AUTO_RESET=true`. |

Solo los valores explícitos (`true`, `1` o `yes`) habilitan una funcionalidad. Cualquier otro valor la mantiene desactivada.

### Inicio de sesión como visitante

Cuando el backend está en modo demostración, la pantalla de autenticación muestra el botón **Entrar como visitante**.

```http
POST /api/auth/demo-login
```

No se expone ninguna credencial pública.

Al usar esta ruta, el backend crea una sesión temporal con una cuenta interna de demostración (`visitante@demo.local`), cuya autenticación solo puede realizarse mediante este endpoint.

La cuenta tiene todos los permisos necesarios para explorar el sistema completo. La seguridad de la demostración no depende de reducir permisos, sino del bloqueo específico de las operaciones que podrían causar efectos permanentes o externos.

### Operaciones bloqueadas

Durante la demostración, determinadas acciones devuelven **HTTP 403** con el mensaje:

> Esta acción está deshabilitada en la demostración.

El panel administrativo refleja este comportamiento deshabilitando visualmente esas acciones e informando el motivo al usuario.

| Acción | Motivo |
|---|---|
| `POST /api/requests/res-withdrawal` | Evita transferencias PIX reales mediante Asaas. |
| `POST` / `PATCH` / `DELETE` en `/api/staff` y `/api/roles` | Impide cambios en usuarios administrativos y permisos del sistema. |
| `PATCH /api/users/update-user` y `/update-pass` | Protege las credenciales de la cuenta administrativa compartida. |

Además, no se ejecuta ninguna integración externa.

Cuando `APP_DEMO=true`, el envío de correos utiliza un **proveedor nulo**, que solo registra los mensajes en los logs de la aplicación.

Siguen disponibles con normalidad:

- gestión de usuarios del bot;
- ajustes manuales de saldo;
- gestión de planes;
- movimientos financieros ficticios;
- consultas y auditorías;
- tickets de soporte;
- dashboards, gráficos y reportes.

### Restauración del entorno

```bash
npm run demo:reset
```

El comando restaura por completo el entorno de demostración.

Entre las operaciones que ejecuta están:

- limpieza de las tablas transaccionales;
- recreación de los datos ficticios;
- sincronización del catálogo de planes;
- limpieza de la caché del dashboard;
- reconstrucción de la red de afiliados;
- generación de los movimientos financieros simulados.

Los datos administrativos se conservan.

Las tablas `staff_users` y `roles` nunca se eliminan, lo que garantiza que los administradores mantengan el acceso al entorno. De igual forma, `products` se sincroniza mediante **upsert**, preservando los identificadores que la aplicación utiliza internamente.

Si `APP_DEMO=false`, el comando se interrumpe de inmediato, antes de cualquier cambio en la base de datos.

Para habilitar la restauración automática:

```env
APP_DEMO=true
AUTO_RESET=true
AUTO_RESET_INTERVAL=60
```

El programador utiliza el mismo proceso de la aplicación e impide ejecuciones concurrentes si un reset sigue en curso.

### Datos de demostración

El generador crea automáticamente un entorno consistente para presentar la plataforma.

El conjunto incluye aproximadamente:

- 300 usuarios;
- red de afiliados en tres niveles;
- planes activos;
- depósitos;
- rendimientos;
- comisiones;
- solicitudes de retiro;
- tickets de soporte;
- historial financiero;
- traza completa de auditoría.

```bash
npm run demo:seed
```

El comando siempre recrea el entorno desde cero antes de generar nuevos datos, lo que evita acumular registros ficticios y garantiza un escenario predecible.

Actualmente, `demo:seed` reutiliza exactamente la misma rutina que `demo:reset`, manteniendo un único flujo de generación de datos.

Las mismas validaciones siguen vigentes: ambos comandos solo pueden ejecutarse cuando `APP_DEMO=true`.

#### Características del entorno

El entorno de demostración sigue dos principios fundamentales:

- **Escenario determinista:** la estructura de la demostración se mantiene consistente en cada restauración, variando únicamente los identificadores internos y las fechas relativas al momento de la ejecución.

- **Consistencia financiera:** todos los saldos permanecen sincronizados con el ledger de transacciones, lo que garantiza que dashboards, reportes y auditorías muestren exactamente los mismos valores.

<h2 id="pruebas">🧪 Pruebas</h2>

El proyecto usa **Vitest** para pruebas unitarias y de integración.

### Ejecutar las pruebas

| Comando | Descripción |
|---|---|
| `npm test` | Ejecuta toda la suite de pruebas. |
| `npm run test:watch` | Ejecuta las pruebas en modo *watch*, reejecutándolas automáticamente ante cambios. |
| `npm run test:coverage` | Ejecuta la suite completa y genera el reporte de cobertura de código. |

Las pruebas combinan:

- **Pruebas unitarias**, enfocadas en reglas de negocio aisladas;
- **Pruebas de integración**, usando instancias reales de **MySQL** y **Redis** levantadas por `docker-compose.dev.yml`.

Los principales flujos cubiertos incluyen:

- autenticación y renovación de tokens JWT;
- movimientos del **WalletService**;
- procesamiento de pagos y webhooks;
- cálculo de comisiones de la red de afiliados.

> **Importante**
>
> Para ejecutar la suite completa de integración, **MySQL** y **Redis** deben estar en ejecución (`npm run docker:up` o `npm run dev:full`).

Las pruebas se ejecutan de forma secuencial (`fileParallelism: false`) para evitar conflictos de concurrencia en operaciones que comparten la misma base de datos.

<h2 id="despliegue">🚀 Despliegue</h2>

Esta guía describe el proceso de despliegue del **Smart Option Backend** (API + bot de Telegram) en un VPS Linux usando Docker Compose y Caddy.

### Requisitos

- VPS Ubuntu/Debian
- acceso root o sudo
- dominio apuntando a la IP del VPS (registro A)
- Docker Engine + Docker Compose

### 1. Instalar Docker

```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER

# Cierra y vuelve a iniciar sesión para aplicar el grupo docker
docker --version
docker compose version
```

Abre los puertos **80** y **443** en el firewall:

```bash
ufw allow 80,443/tcp
```

> Solo Caddy queda expuesto a internet. La API, MySQL y Redis permanecen accesibles únicamente desde la red interna de Docker Compose.

### 2. Clonar el proyecto

```bash
git clone <url-del-repositorio> smart-option
cd smart-option

cp .env.production.example .env
```

Edita el archivo `.env` con los valores reales de producción.

#### Configuraciones obligatorias

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
> Los valores que empiezan con `$` (como `ASAAS_API_KEY`) deben ir entre comillas simples:
>
> ```env
> ASAAS_API_KEY='$aact_prod_...'
> ```
>
> Sin ellas, Docker Compose puede interpretar el valor como otra variable de entorno.

> `DB_HOST` y `REDIS_URL` no necesitan modificarse en producción: Docker Compose ya los apunta automáticamente a los servicios internos.

El archivo `.env` se monta directamente en el contenedor y debe permanecer en la raíz del proyecto.

### 3. Iniciar la base de datos y Redis

```bash
docker compose -f docker-compose.prod.yml up -d mysql redis

docker compose -f docker-compose.prod.yml ps
```

Espera a que ambos servicios queden en estado **healthy**.

### 4. Ejecutar las migraciones

```bash
docker compose -f docker-compose.prod.yml --profile tools run --rm migrate
```

En el primer despliegue, ejecuta también:

```bash
docker compose -f docker-compose.prod.yml --profile tools run --rm migrate npm run db:seed
```

El seed inicial crea los productos predeterminados que usa el sistema.

### 5. Iniciar la aplicación

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

#### Renovación del certificado

No se requiere ninguna configuración adicional.

Caddy renueva automáticamente los certificados de Let's Encrypt antes de que venzan, sin cron ni intervención manual.

### 6. Operación

#### Logs

```bash
docker compose -f docker-compose.prod.yml logs -f app
docker compose -f docker-compose.prod.yml logs -f caddy
```

#### Actualización

```bash
git pull

docker compose -f docker-compose.prod.yml up -d --build app
```

Si hay migraciones nuevas, ejecuta nuevamente el paso **4** antes de levantar la nueva versión.

#### Detener la aplicación

```bash
docker compose -f docker-compose.prod.yml stop app
```

La aplicación realiza un apagado ordenado: cierra la API, el bot, el worker de webhooks y las conexiones a la base de datos antes de finalizar el proceso.

#### Respaldos

```bash
docker compose -f docker-compose.prod.yml exec mysql \
mysqldump -u root -p"$DB_PASSWORD" "$DB_DATABASE" \
| gzip > backup-$(date +%F).sql.gz
```

Conviene almacenar los respaldos fuera del VPS.

### 7. Limitaciones conocidas

- El contenedor `app` no admite múltiples réplicas mientras el bot use **long polling**. Ejecutar dos instancias al mismo tiempo genera un error **409** de Telegram.

- Escalar horizontalmente requeriría separar la API y el bot en servicios independientes y migrar Telegram a **webhooks**.

- El despliegue no incluye un pipeline de **CI/CD**: las actualizaciones se realizan manualmente.

- Caddy usa la imagen oficial, sin un módulo adicional de rate limiting. La protección contra abuso sigue a cargo de la propia aplicación, mediante Redis.

<h2 id="seguridad">🔒 Seguridad</h2>

El modelo de seguridad de la aplicación se centra en proteger la autenticación, los movimientos financieros y la comunicación entre servicios.

- **Base de datos:** todas las consultas de negocio usan Drizzle ORM con queries parametrizadas, sin SQL construido por concatenación de entradas externas.
- **Contraseñas:** almacenadas con **bcrypt** (costo 12). Los hashes heredados en **SHA-1** se migran automáticamente a bcrypt en el primer inicio de sesión (*lazy migration*).
- **Autenticación:** access tokens JWT de corta duración combinados con **refresh tokens rotativos**, con detección de reutilización y revocación automática de toda la familia de tokens.
- **Rate limiting:** límites globales y específicos para la autenticación almacenados en Redis, lo que garantiza un comportamiento consistente incluso con varias instancias de la aplicación.
- **Webhooks:** validación de firma con comparación en tiempo constante (*constant-time comparison*), protegiendo contra ataques de temporización.
- **Seguridad HTTP:** Helmet, política de CORS basada en *allowlist* y `trust proxy` configurado exclusivamente para el proxy inverso de la infraestructura.
- **Infraestructura:** solo Caddy expone los puertos **80** y **443** en producción. La API, MySQL y Redis permanecen aislados en la red interna de Docker Compose, con TLS emitido y renovado automáticamente por Let's Encrypt.
- **Secretos:** todas las credenciales provienen exclusivamente de variables de entorno, sin información sensible en el código fuente.

<h2 id="solucion-de-problemas">🛠️ Solución de problemas</h2>

### `cloudflared` no se encuentra en el `PATH`

El Cloudflare Tunnel no está instalado o no está disponible en el `PATH`.

Consulta la [sección Cloudflare Tunnel](#cloudflare-tunnel) para instalarlo.

---

### `cloudflared` instalado, pero la máquina no está autenticada

Ejecuta:

```bash
cloudflared tunnel login
```

Se abrirá el navegador para la autenticación. Selecciona la cuenta y la zona del dominio que usa el proyecto.

---

### `ASAAS_API_KEY` inválida dentro de Docker

Si la aplicación reporta **"clave inválida"** aun con la variable configurada correctamente, verifica que esté entre comillas simples.

```env
ASAAS_API_KEY='$aact_hmlg_...'
```

Como las claves de Asaas empiezan con `$`, Docker Compose puede interpretar ese carácter como una variable de entorno al leer el `.env`.

---

### MySQL o Redis siguen en estado `unhealthy`

Revisa los logs de los servicios:

```bash
docker compose -f docker-compose.dev.yml logs mysql redis
```

En el primer arranque, MySQL puede tardar unos segundos más en completar el bootstrap.

---

### Error `EADDRINUSE`

Otra instancia de la API ya está usando el puerto configurado en `APP_PORT`.

Detén la instancia anterior:

```bash
npm run docker:down
```

o finaliza manualmente el proceso que ocupa el puerto.

> `npm run dev:full` reutiliza automáticamente una API ya disponible siempre que es posible.

---

### Error 409 de Telegram

```
terminated by other getUpdates request
```

El bot usa **long polling**, que permite solo una instancia con el mismo `BOT_TOKEN`.

Confirma que no haya otra aplicación (desarrollo o producción) ejecutándose al mismo tiempo con el mismo token.

---

### No se crea el registro DNS del túnel

Verifica que la cuenta autenticada tenga acceso a la zona del dominio que usa el proyecto:

```bash
cloudflared tunnel login
```

Si el registro no se crea automáticamente, puedes agregarlo manualmente desde el panel de Cloudflare.

<h2 id="licencia">📄 Licencia</h2>

Este proyecto se distribuye bajo la **Smart Option Source Available License (SSAL)**.

Puedes:

- estudiar el código fuente;
- hacer un fork del repositorio con fines educativos;
- usar partes de la implementación como referencia de aprendizaje.

**No** puedes:

- usar este proyecto con fines comerciales;
- ofrecerlo como producto o servicio;
- crear plataformas de inversión, marketing multinivel (MLM), HYIP, esquemas Ponzi, pirámides financieras, apuestas o cualquier otro servicio financiero similar a partir de este código.

Consulta el archivo [LICENSE](LICENSE) para conocer los términos completos.

<h2 id="proyectos-relacionados">🔗 Proyectos relacionados</h2>

**Smart Option** fue desarrollado como un ecosistema de aplicaciones independientes, cada una con una responsabilidad específica. Dividirlo en varios repositorios aporta orden, facilita el desarrollo en paralelo y da como resultado una arquitectura más modular y escalable.

| Proyecto | Descripción | Repositorio |
|----------|-----------|-------------|
| 🌐 Landing Page | La landing page oficial de Smart Option, creada para presentar la plataforma, sus diferenciales y la experiencia que ofrece a los usuarios. | https://github.com/issagomesdev/smart-option-page |
| 👑 Panel Admin (Frontend) | La interfaz administrativa para gestionar la plataforma Smart Option. | https://github.com/issagomesdev/smart-option-admin |
