# Build context: repository root (needs packages/shared).

FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN npm ci
COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY apps/api apps/api
RUN npm run build -w @agenda/shared \
  && npm run db:generate -w api \
  && npm run build -w api

FROM node:24-alpine AS runtime
ENV NODE_ENV=production \
    CHECKPOINT_DISABLE=1 \
    PRISMA_HIDE_UPDATE_MESSAGE=1 \
    NPM_CONFIG_UPDATE_NOTIFIER=false
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN npm ci --omit=dev -w api -w @agenda/shared && npm cache clean --force
COPY --from=build /app/packages/shared/dist packages/shared/dist
COPY --from=build /app/apps/api/dist apps/api/dist
# Prisma CLI needs the config, schema and migrations for `migrate deploy`.
COPY apps/api/prisma.config.ts apps/api/
COPY apps/api/prisma/schema.prisma apps/api/prisma/
COPY apps/api/prisma/migrations apps/api/prisma/migrations
WORKDIR /app/apps/api
USER node
EXPOSE 3333
# Migrations -> idempotent seed -> server (PRD section 14.1).
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/prisma/seed.js && exec node dist/src/server.js"]
