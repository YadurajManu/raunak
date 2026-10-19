# Configuration and command reference

The checked-in `.env.example` is the complete starting point for configuration names. This reference groups the principal settings by responsibility without including real credentials or account-specific values.

## Application and local services

| Setting | Purpose |
| --- | --- |
| `APP_URL` | Browser-facing origin used by links, callbacks and mutation origin checks |
| `DATABASE_URL` | PostgreSQL connection for Prisma and the gateway |
| `REDIS_URL` | BullMQ queue and gateway coordination connection |
| `TICKET_SIGNING_SECRET` | At least 32 characters, used to sign admission tokens |
| `ENCRYPTION_KEY` | Independent 32 random bytes encoded as 64 hex characters or base64 |

The root Compose database is exposed at port 5433 for local development. Its internal working database identifiers are retained; changing the public brand name does not require renaming the database.

## Authentication and review access

| Setting | Purpose |
| --- | --- |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Firebase web app configuration |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Firebase web auth domain |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Firebase web project identifier |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | Firebase web application identifier |
| `FIREBASE_PROJECT_ID` | Server-side Firebase project |
| `FIREBASE_CLIENT_EMAIL` | Service-account identity |
| `FIREBASE_PRIVATE_KEY` | Server service-account key with escaped newlines |
| `RAUNAK_ADMIN_FIREBASE_UIDS` | Comma-separated UID allowlist for platform review |

The public Firebase values are different from server credentials. Never add service-account values to a `NEXT_PUBLIC_*` setting.

## Payment, storage and delivery

| Group | Configuration |
| --- | --- |
| Cashfree | `CASHFREE_ENV`, `CASHFREE_APP_ID`, `CASHFREE_SECRET_KEY`, `CASHFREE_API_VERSION` |
| Object storage | `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_PUBLIC_BASE_URL` |
| Email | `EMAIL_PROVIDER`, `EMAIL_FROM`, `RESEND_API_KEY` or `SMTP_HOST`/`SMTP_PORT`/optional SMTP credentials |
| Official WhatsApp | `WHATSAPP_PROVIDER`, `WHATSAPP_CLOUD_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_WABA_ID`, `WHATSAPP_API_VERSION`, `WHATSAPP_TEMPLATE_MAP` |
| Meta webhook | `WHATSAPP_WEBHOOK_VERIFY_TOKEN`, `WHATSAPP_APP_SECRET` |
| Linked gateway | `WA_UNOFFICIAL_ENABLED`, `WA_GATEWAY_ENGINE`, `WA_GATEWAY_URL`, `WA_GATEWAY_API_KEY`, gateway bind address/port, caps and pacing |
| Maps | `GEOAPIFY_API_KEY`, `NEXT_PUBLIC_MAP_TILE_URL`, `NEXT_PUBLIC_MAP_ATTRIBUTION` |

`AWS_REQUEST_CHECKSUM_CALCULATION=WHEN_REQUIRED` is included in the local/storage configuration. Provider selection does not activate a remote account: follow [integration setup](integrations.md).

## Available commands

| Command | Behavior |
| --- | --- |
| `pnpm dev` | Start Next.js development server |
| `pnpm build` | Create production Next.js build |
| `pnpm start` | Run an existing production build |
| `pnpm worker` | Start artwork, ticket, notification and maintenance workers |
| `pnpm db:migrate` | Apply checked-in Prisma migrations to configured database |
| `pnpm exec prisma generate` | Generate the Prisma client |
| `pnpm exec next typegen` | Generate route types for the installed Next.js version |
| `pnpm typecheck` | Run TypeScript without emitting files |
| `pnpm lint` | Run ESLint |
| `pnpm test` | Run Vitest, including service-dependent integration tests |
| `pnpm test:e2e` | Run Playwright browser tests |
| `pnpm check:theme-colors` | Inspect theme color usage |
| `pnpm check:contrast` | Run token contrast checks and browser contrast coverage |

Inspect any seed or operational script before running it: those commands may write data or contact configured providers. They are not required to read documentation or start an empty development application.

## Application routes and API boundaries

| Surface | Route |
| --- | --- |
| Public documentation | `/docs` and the explicit guide slugs |
| Discovery | `/discover` |
| Public event | `/e/[slug]` |
| Organizer profile | `/organizers/[slug]` |
| Account and tickets | `/account`, `/my-tickets`, `/orders/[id]` |
| Organizer workspace | `/dashboard` and its event/settings pages |
| Platform event review | `/admin`, restricted to allowlisted users |
| Cashfree webhook | `/api/webhooks/cashfree` |
| Official WhatsApp webhook | `/api/webhooks/whatsapp` |

These are application routes, not a versioned public developer API or SDK contract. Authenticated mutations enforce their existing session, origin and role checks. Do not call private routes as though possession of an event, booking or ticket ID grants access.

## Review alert destination

The current publication-review email helper contains an operator recipient in server code. It is not configured by an environment variable in the implementation reviewed here. A self-hosting operator should inspect and adapt that recipient before relying on review notifications; this guide does not expose the installation's personal address.
