FROM node:24-bookworm-slim
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/* && npm install -g pnpm@10.12.4
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
ARG NEXT_PUBLIC_FIREBASE_API_KEY
ARG NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
ARG NEXT_PUBLIC_FIREBASE_PROJECT_ID
ARG NEXT_PUBLIC_FIREBASE_APP_ID
ARG NEXT_PUBLIC_MAP_TILE_URL
ARG NEXT_PUBLIC_MAP_ATTRIBUTION
ENV NEXT_TELEMETRY_DISABLED=1
RUN DATABASE_URL=postgresql://build:build@localhost/build pnpm exec prisma generate && NODE_OPTIONS=--max-old-space-size=1024 pnpm build
ENV NODE_ENV=production
EXPOSE 3000
CMD ["pnpm", "start"]
