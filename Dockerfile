# iVent NeoPed — Avaliação (mesmo padrão de imagem do iVent NeoPed)
FROM node:24-alpine AS build
ENV NPM_CONFIG_UPDATE_NOTIFIER=false NPM_CONFIG_FUND=false
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . ./
RUN npm run build

FROM node:24-alpine
ENV NODE_ENV=production NPM_CONFIG_UPDATE_NOTIFIER=false NPM_CONFIG_FUND=false PORT=3000 STATIC_ROOT=dist
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY --from=build --chown=node:node /app/dist ./dist
COPY --chown=node:node server ./server
COPY --chown=node:node shared ./shared
# Sem privilégio de root no contêiner.
USER node
EXPOSE 3000
# Migrations e seed idempotente rodam no boot (server/index.ts) antes de aceitar tráfego.
CMD ["node", "--import", "tsx", "server/index.ts"]
