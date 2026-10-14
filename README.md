# Eventra

India-first event ticketing SaaS. Phase 1 implementation is in progress. Read `project.md` for product scope and `context.md` for architecture.

## Local setup

1. Install Node 24, pnpm 10, and Docker.
2. `cp .env.example .env` and fill provider credentials.
3. `docker compose up -d`.
4. `pnpm install && pnpm dev`.
5. Open <http://localhost:3000>; health check: <http://localhost:3000/api/health>.

`pnpm typecheck`, `pnpm lint`, and `pnpm test` check the current scaffold.

## Decisions

Environment validation is called by services as they are added, so the health route and initial UI run before external credentials are configured. Each service will fail clearly when its required credentials are absent.

Local S3 uses LocalStack because the public MinIO container images were unavailable in October 2026. The S3-compatible API remains at `http://localhost:9000`.
