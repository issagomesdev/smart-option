## Build multi-stage: builder compila o TypeScript com todas as devDependencies;
## a imagem final só carrega dist/ + node_modules de produção — nenhuma
## ferramenta de build ou código-fonte TS vai para o runtime. O estágio `dev`
## compartilha a instalação de dependências com `builder` mas nunca compila —
## o código-fonte entra via bind mount do docker-compose.dev.yml, para hot reload.

FROM node:24-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM deps AS dev
COPY tsconfig.json drizzle.config.ts ./
EXPOSE 3000
CMD ["npx", "tsx", "watch", "src/index.ts"]

FROM deps AS builder
COPY tsconfig.json drizzle.config.ts ./
COPY src ./src
RUN npm run build

# Este estágio (builder) mantém devDependencies, código-fonte TS e
# migrations — de propósito, é usado diretamente via `--target builder`
# para rodar `npm run db:migrate`/`db:seed` num container efêmero (ver
# serviço "migrate" em docker-compose.prod.yml), sem precisar de imagem própria.

FROM builder AS pruned
# Remove as devDependencies do node_modules já usado na build, em vez de
# rodar um segundo `npm ci` na imagem final — mais rápido e garante que é
# exatamente a mesma resolução de dependências que compilou o projeto.
RUN npm prune --omit=dev

FROM node:24-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app

# Usuário não-root dedicado — a imagem base node:*-alpine já traz "node"
# (uid 1000), mas ele não é dono de /app por padrão.
RUN chown -R node:node /app
USER node

COPY --chown=node:node --from=pruned /app/node_modules ./node_modules
COPY --chown=node:node --from=pruned /app/dist ./dist
COPY --chown=node:node package.json ./
COPY --chown=node:node confirm.html ./

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.APP_PORT||3000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "dist/index.js"]
