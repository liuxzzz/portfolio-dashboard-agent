# syntax=docker/dockerfile:1.7

FROM node:24-bookworm-slim

ENV NODE_ENV=production
WORKDIR /app

RUN apt-get update \
    && apt-get install --yes --no-install-recommends ca-certificates openssl \
    && rm -rf /var/lib/apt/lists/* \
    && npm install --global pnpm@11.9.0

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/api/package.json ./apps/api/package.json
COPY apps/api/prisma.config.ts ./apps/api/prisma.config.ts
COPY apps/api/prisma/schema.prisma ./apps/api/prisma/schema.prisma
COPY packages/agent-core/package.json ./packages/agent-core/package.json
COPY packages/domain/package.json ./packages/domain/package.json

RUN pnpm install --frozen-lockfile --filter @portfolio/api...

COPY apps/api ./apps/api
COPY packages/agent-core ./packages/agent-core
COPY packages/domain ./packages/domain

RUN pnpm --filter @portfolio/api prisma:generate \
    && pnpm --filter @portfolio/api typecheck

USER node

EXPOSE 4000

CMD ["pnpm", "--filter", "@portfolio/api", "exec", "tsx", "src/index.ts"]
