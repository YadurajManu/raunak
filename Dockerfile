FROM node:24-bookworm-slim AS base
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates fonts-noto-core && rm -rf /var/lib/apt/lists/* && npm install -g pnpm@10.12.4
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/wa-contracts/package.json ./packages/wa-contracts/package.json
COPY services/wa-gateway/package.json ./services/wa-gateway/package.json
COPY patches ./patches
RUN pnpm install --frozen-lockfile
COPY . .
RUN DATABASE_URL=postgresql://build:build@localhost/build pnpm exec prisma generate
FROM base AS wa-gateway
ENV NODE_ENV=production
CMD ["pnpm", "--filter", "@raunak/wa-gateway", "start"]
FROM base AS web
ARG NEXT_PUBLIC_FIREBASE_API_KEY
ARG NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
ARG NEXT_PUBLIC_FIREBASE_PROJECT_ID
ARG NEXT_PUBLIC_FIREBASE_APP_ID
ARG NEXT_PUBLIC_MAP_TILE_URL
ARG NEXT_PUBLIC_MAP_ATTRIBUTION
ENV NEXT_TELEMETRY_DISABLED=1
RUN NODE_OPTIONS=--max-old-space-size=1024 pnpm build && rm -rf .next/cache
ENV NODE_ENV=production
EXPOSE 3000
CMD ["pnpm", "start"]
