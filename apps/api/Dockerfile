FROM node:22-bookworm-slim AS builder

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

RUN corepack enable
WORKDIR /app

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml tsconfig.base.json ./
COPY apps/api/package.json apps/api/package.json
COPY packages/shared/package.json packages/shared/package.json

RUN pnpm install --frozen-lockfile

COPY . .

RUN pnpm --filter @lexigram/shared build
RUN pnpm --filter @lexigram/api prisma:generate
RUN pnpm --filter @lexigram/api build

FROM node:22-bookworm-slim AS runner

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
ENV NODE_ENV=production

RUN corepack enable
WORKDIR /app

COPY --from=builder /app /app

EXPOSE 4000

CMD ["sh", "-c", "pnpm --filter @lexigram/api prisma:migrate && pnpm --filter @lexigram/api prisma:seed && pnpm --filter @lexigram/api start"]
