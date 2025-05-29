# 🤖 Smart Option — Telegram finance Bot

![Node.js](https://img.shields.io/badge/Node.js-18.x-green?style=for-the-badge&logo=node.js&logoColor=white) ![TypeScript](https://img.shields.io/badge/TypeScript-%23007ACC.svg?style=for-the-badge&logo=typescript&logoColor=white) ![Express.js](https://img.shields.io/badge/Express.js-%23404d59.svg?style=for-the-badge&logo=express&logoColor=white) ![Telegram](https://img.shields.io/badge/Telegram-Bot-2CA5E0?style=for-the-badge&logo=telegram&logoColor=white) ![PagBank](https://img.shields.io/badge/PagBank-API-32B768?style=for-the-badge&logo=pagseguro&logoColor=white) ![JWT](https://img.shields.io/badge/JWT-Auth-%2300A7E1?style=for-the-badge&logo=jsonwebtokens&logoColor=white) ![Next.js](https://img.shields.io/badge/Next.js-Admin%20Panel-%23000000?style=for-the-badge&logo=next.js&logoColor=white)

<p align="center">
  <a href="#about">About</a> •
  <a href="#features">Features</a> •
  <a href="#technologies">Technologies</a> •
  <a href="#structure">Structure</a> •
  <a href="#route">Routes</a> •
  <a href="#getting-started">Getting Started</a> •
  <a href="#related-projects">Related Projects</a>
</p>

Automated investment platform with **Telegram bot**, **admin panel**, and **PagBank integration**. Includes full flows for registration, finances, affiliate network, and support.

This repository contains the **Telegram Bot** and **RESTful API** developed in **Node**, responsible for all backend operations.

💻 You can try the live demo at [Bot on Telegram](https://web.telegram.org/k/#@smartoptionea_bot)

> ⚠️ **Important Notice:**  
> This is a demonstration version intended for testing and preview purposes only.  
> **Do not perform real transactions or payments.**  
> The creator is **not responsible** for any real financial operations made using this demo.

<h2 id="about"> 📌 About</h2>

**SmartOption** is a fully automated Telegram-based investment platform. It allows users to register, deposit funds, receive daily profits, manage their affiliate network, and get support — all through a conversational interface.

The project also includes an [Admin Panel Repository](https://github.com/issagomesdev/smart-option-admin) built with **Next.js + TypeScript** for managing users, balances, withdrawals, and monitoring activity.

<h2 id="features">✨ Features</h2>

### 🤖 Telegram Bot

- **User registration and login system**
- **Intuitive navigation menu**
- **Integration with PagBank payment API**  
  - Used for product subscription and deposit transactions  
  - Generates personalized payment links  
  - Automatically updates transactions: releases product or credit when status becomes "PAID"  
- **Automatic product expiration updates**  
  - Daily check for expired plans  
  - Each plan is valid for **30 days after subscription**  
  - Checks user balance for automatic renewal  
  - If the balance is sufficient, renews for another month; otherwise, user is marked as inactive  
- **Daily profitability system**  
  - Only **active users** (with valid plans) receive daily earnings  
  - Values depend on the product acquired and the user's current balance  
- **Affiliate network system with 3 levels**  
  - Level 1: affiliates directly invited by the user  
  - Level 2: affiliates invited by level 1 affiliates  
  - Level 3: affiliates invited by level 2 affiliates  
  - Users earn commissions from product subscriptions and daily earnings based on affiliates' balance  
  - Users can have unlimited affiliates but only earn commissions from up to 9 (3 per level)  
  - View your affiliate network, levels, and status through the "🚻 NETWORK" menu option  
- **Finance menu**  
  - **Deposit system** (add funds to earn daily profitability)  
  - **Withdrawal system** (request payouts anytime)  
  - **Balance transfer** between users using the registered email  
  - View **current balance** with your **earnings**  
  - **Complete transaction history** with type, source, and date  
  - Track **status** of deposit, withdrawal, and subscription requests  
- **Automated support with escalation to human assistance**

> ℹ️ **Active users** are those with at least **one valid plan**. Plans expire **30 days after subscription**.

### 🌐 Admin Panel API

- **Admin authentication and access control**
- **Dashboard with system metrics and statistics**
- **User data query and management**
- **Management of requests for:**
  - Deposits  
  - Product subscriptions  
  - Withdrawals  
- **Affiliate network overview and management**
- **Integration with PagBank API for automated transactions**
- **Centralized support ticket management**

<h2 id="technologies">🛠️ Technologies</h2>

- **Node.js** – Backend runtime for the Telegram bot and API
- **TypeScript** – Strongly typed JavaScript for safer and more scalable code
- **Express.js** – Web framework for building the RESTful API
- **node-telegram-bot-api** – Library for interacting with the Telegram Bot API
- **PagBank API** – Payment gateway used for product subscriptions, deposits, and transaction tracking
- **Cron Jobs (node-cron)** – For daily tasks like plan expiration checks and profitability updates
- **JWT (JSON Web Token)** – Secure authentication for the admin panel

<h2 id="structure"> 📁 Structure</h2>

Overview of the main folders and files in the project:

```txt
📁 src/                             # Main source directory
 ┣ 📄 index.ts                      # Entry point

 ┣ 📁 bot/                          
 ┃ ┣ 📄 index.ts                    
 ┃ ┣ 📁 components/                 
 ┃ ┃ ┣ 📄 auth.ts                   # User login/register logic
 ┃ ┃ ┣ 📄 mainMenu.ts               # Navigation menu
 ┃ ┃ ┗ 📄 index.ts                  # Entry for all components
 ┃ ┗ 📁 sections/                   
 ┃   ┣ 📄 affiliateLink.ts          # Affiliate link generator
 ┃   ┣ 📄 balance.ts                # Financial menu flow
 ┃   ┣ 📄 login.ts                  # Login flow
 ┃   ┣ 📄 network.ts                # Affiliate network flow
 ┃   ┣ 📄 products.ts               # Product subscription
 ┃   ┣ 📄 register.ts               # Registration flow
 ┃   ┣ 📄 rules.ts                  # Platform rules flow
 ┃   ┗ 📄 suport.ts                 # Support flow
 ┣ 📁 config/                       
 ┃ ┗ 📄 env.ts                      # Loads and exports .env variables

 ┣ 📁 db/                          
 ┃ ┣ 📄 base.sql                    # Database file
 ┃ ┗ 📄 index.ts                   

 ┣ 📁 exceptions/                   # Global exception handling
 ┃ ┗ 📄 http.exception.ts           # Custom HTTP error classes

 ┣ 📁 server/                       # Backend API for admin panel
 ┃ ┣ 📄 cron.ts                    
 ┃ ┣ 📄 genKeys.ts                  
 ┃ ┣ 📄 index.ts                   
 ┃ ┣ 📁 middlewares/                
 ┃ ┃ ┣ 📄 auth.interceptor.ts       # JWT authentication middleware
 ┃ ┃ ┗ 📄 error.handler.ts         
 ┃ ┗ 📁 routes/                     
 ┃   ┣ 📄 auth.routes.ts            # Auth routes for admin
 ┃   ┣ 📄 dash.routes.ts            # Dashboard statistics and summaries
 ┃   ┣ 📄 index.ts                  # Router initialization
 ┃   ┣ 📄 network.routes.ts         # Affiliate data and tree
 ┃   ┣ 📄 requests.routes.ts        # Deposit, withdrawal, product requests
 ┃   ┣ 📄 transactions.routes.ts    # Transaction monitoring
 ┃   ┣ 📄 users.routes.ts           # Users management
 ┃   ┗ 📄 validateEmail.routes.ts   # Email verification logic

 ┗ 📁 services/                     
   ┣ 📄 authentication.service.ts   # Auth and session management
   ┣ 📄 dash.service.ts             # Dashboard metrics
   ┣ 📄 network.service.ts          # Affiliate network engine
   ┣ 📄 requests.service.ts         # Deposit/product/withdrawal flow
   ┣ 📄 users.service.ts            # User data manipulation
   ┗ 📁 bot/                        # Services exclusive to the bot
     ┣ 📄 auth.service.ts           # Bot-side auth services 
     ┣ 📄 network.service.ts        # Affiliates network services 
     ┣ 📄 products.service.ts       # Bot products services 
     ┣ 📄 register.service.ts       # Bot-side registration services 
     ┣ 📄 requests.service.ts       # Deposit, withdrawal, and subscription requests services 
     ┗ 📄 transactions.service.ts   # Financial transactions services 

📄 .env                             # Environment variable definitions
📄 .env.copy                        # Sample .env file
📄 confirm.html                     # Email confirmation template

```

<h2 id="routes">📍 Application Routes</h2>

### 🔐 Auth Routes (`/api/auth`)

| Method | URI           | Description                       |
|--------|---------------|---------------------------------|
| POST   | `/`           | Login to the front panel         |
| POST   | `/token`      | Token validation in the panel    |

### 👤 Users Routes (`/api/users`)

| Method | URI                          | Description                                |
|--------|------------------------------|--------------------------------------------|
| GET    | `/`                          | List users (panel)                         |
| PATCH  | `/update-user`               | Update user data (panel)                   |
| PATCH  | `/update-pass`               | Update user password (panel)               |
| GET    | `/users-bot/:search`         | Search users (bot) with a term             |
| POST   | `/users-bot`                 | Search users (bot) with filters            |
| GET    | `/user-bot/:id`              | Get user data (bot)                        |
| POST   | `/user-bot`                 | Register user (bot)                        |
| PATCH  | `/user-bot`                 | Update user (bot)                          |
| DELETE | `/user-bot/:id`             | Delete user (bot)                          |
| PUT    | `/user-bot/:id/:status`     | Activate/deactivate user (bot)             |
| POST   | `/transf-user-admin`        | Transfer funds (admin → bot user)          |

### 📊 Dashboard Routes (`/api/dashboard`)

| Method | URI                                         | Description                              |
|--------|---------------------------------------------|------------------------------------------|
| GET    | `/users`                                   | List users (bot)                        |
| GET    | `/balance/:user_id/:product_id/:period`    | Get balance filtered by user/product/period |
| GET    | `/plans`                                   | List plans/products                     |

### 🌐 Network Routes (`/api/network`)

| Method | URI        | Description                  |
|--------|------------|------------------------------|
| POST   | `/:id`     | Get user's network           |

### 📋 Requests Routes (`/api/requests`)

| Method  | URI                       | Description                                  |
|---------|---------------------------|----------------------------------------------|
| GET     | `/extract/:id`            | Get user statement                          |
| POST    | `/extract/:id`            | Get filtered statement                      |
| POST    | `/withdrawal/:id`         | Withdrawal requests                         |
| POST    | `/deposit/:id`            | Deposit requests                            |
| POST    | `/support/:id`            | Support requests                            |
| POST    | `/subscription/:id`       | Product subscription requests               |
| POST    | `/res-withdrawal`         | Approve or reject withdrawal requests      |
| PATCH   | `/was-read/:id/:status`   | Mark support requests as read               |
| GET     | `/pendencies`             | Get pending requests for response          |

### 💰 Transactions Routes (`/transactions`)

| Method | URI                       | Description                              |
|--------|---------------------------|------------------------------------------|
| POST   | `/checkouts/:reference_id` | Update pagbank checkouts route          |
| POST   | `/transfers/:reference_id` | Update pagbank pix transfers route      |

### 📧 Email Validation Route (`/email/verify`)

| Method | URI          | Description                |
|--------|--------------|----------------------------|
| GET    | `/:token`    | Email validation page      |

<h2 id="getting-started">▶️ Getting Started</h2>

Follow these steps to run the project locally:

### Prerequisites

- Node.js (version 16 or higher recommended)
- MySQL database
- Telegram Bot Token (from BotFather)
- PagBank API credentials

### Installation

```bash
# Clone the repository
git clone https://github.com/issagomesdev/smart-option.git

cd smart-option

# Install dependencies
npm install
# or
yarn install

# Go to the "db" folder and import the "base.sql" file into your database.

# Copy the environment variables file and edit it
cp .env.copy .env
# Edit the .env file with your Telegram, database, and PagBank credentials

# Start the project
node src/index.ts
```
<h2 id="related-projects">🔗 Related Projects</h2>

👑 Fontend (Admin Panel) repository [here](https://github.com/issagomesdev/smart-option-admin)






