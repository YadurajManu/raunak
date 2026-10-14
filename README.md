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

## Authentication and team

Create a Firebase project and enable Email/Password and Google sign-in. Set the four `NEXT_PUBLIC_FIREBASE_*` values from its web app configuration. Create a service account and set `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, and `FIREBASE_PRIVATE_KEY` from its JSON key (escape line breaks as `\n` in `.env`). Add `localhost` to Firebase authorized domains. New email/password users must verify their email before creating a server session.

Local invitation email uses Mailpit at <http://localhost:8025> with `EMAIL_PROVIDER=smtp`, `SMTP_HOST=localhost`, `SMTP_PORT=1025`, and `EMAIL_FROM`. For production, set `EMAIL_PROVIDER=resend`, a verified sender in `EMAIL_FROM`, and `RESEND_API_KEY`. Team invitation links are valid for seven days and match the signed-in email address.

## Current implementation

M0 and M1 are complete and verified locally. M2 has Firebase sign-in, sessions, workspace creation, invitations, role changes, removals, and tenant checks; external Firebase sign-in needs project credentials to verify manually. Event creation, checkout, delivery, scanner, and analytics remain in the next milestones.

## Decisions

Next.js Cache Components are disabled for now because authenticated pages resolve cookie and database data at request time. The public pages can be cached separately when built.

## Media worker

Run `pnpm worker` alongside `pnpm dev`. Images are uploaded directly to S3-compatible storage through five-minute presigned URLs, then processed by the Redis-backed worker. LocalStack starts with an `eventra` bucket, browser CORS, and public access only for generated variants. Originals stay private. For AWS S3 or Cloudflare R2, set the `S3_*` variables and configure the same CORS and variant-read policy on that bucket.

The image limit is 20 per event and 10 MB per file. The worker verifies the actual file format before decoding and creates thumb, card, hero, and OG sizes in AVIF, WebP, and JPEG. HEIC/HEIF uses a dedicated decoder. `pnpm test` exercises all six accepted format families against the local S3 service.

A deletion that races an already-running conversion can leave an unreferenced variant in storage. A durable deletion outbox is needed before using this for sensitive uploads; event images should be treated as public assets.
