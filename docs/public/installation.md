# Install and run locally

Use a development environment with your own Firebase project and provider sandbox accounts. The web application and background worker run as separate processes.

## Prerequisites

- Node.js 24, matching the repository Dockerfile.
- pnpm 10.12.4, matching `packageManager` in `package.json`.
- Docker with Docker Compose.
- A Firebase project for email/password or Google sign-in.
- Cashfree sandbox credentials only if you want to exercise paid checkout.

## Get the source and dependencies

```bash
git clone https://github.com/YadurajManu/raunak.git
cd raunak
pnpm install --frozen-lockfile
cp .env.example .env
docker compose up -d
```

The root `docker-compose.yml` starts PostgreSQL 16, Redis 7, LocalStack S3 and Mailpit. Allow their initialization to finish before migrating or uploading files. LocalStack's initialization script creates the development bucket and applies its local policies.

| Service | Local address |
| --- | --- |
| Web application | `http://localhost:3000` |
| Health endpoint | `http://localhost:3000/api/health` |
| PostgreSQL | `localhost:5433` |
| Redis | `localhost:6379` |
| S3 endpoint | `http://localhost:9000` |
| Mailpit SMTP | `localhost:1025` |
| Mailpit inbox | `http://localhost:8025` |

## Configure Firebase

Register a web app in Firebase. Enable Email/Password and, if wanted, Google in Firebase Authentication. Authorize `localhost` for development and enter the web app's four `NEXT_PUBLIC_FIREBASE_*` values in `.env`.

Add the corresponding server service-account values: `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL` and `FIREBASE_PRIVATE_KEY`. Keep the private key quoted and represent its line breaks as `\n`. The server replaces escaped newlines before using the key.

> [!WARNING]
> A Firebase service-account key belongs only on the server. Never put it in a `NEXT_PUBLIC_*` setting, a screenshot or a commit.

## Set independent signing and encryption values

Generate a fresh value for `TICKET_SIGNING_SECRET`, then run the command again for a different `ENCRYPTION_KEY` value:

```bash
openssl rand -hex 32
```

The ticket secret signs admission links. The encryption key protects linked WhatsApp session state and related private data. Keep independent copies in your secret manager; replacing an encryption key does not re-encrypt existing state.

Keep `APP_URL=http://localhost:3000` for the default web port. Same-origin checks compare browser requests with this value. The example local database, Redis, S3 and SMTP values match the root Compose services.

## Prepare the database

```bash
pnpm exec prisma generate
pnpm db:migrate
```

This generates the Prisma client and applies checked-in migrations to the database selected by `DATABASE_URL`. Review that URL before running the migration command.

## Run the web application and worker

In the first terminal:

```bash
pnpm dev
```

In a second terminal, from the same project directory:

```bash
pnpm worker
```

Open [the local application](http://localhost:3000), or [the local documentation](http://localhost:3000/docs). The worker processes uploaded artwork, ticket PDFs, notifications and expired inventory holds.

## Verify your setup

```bash
curl http://localhost:3000/api/health
pnpm exec vitest run tests/unit
```

The health endpoint should return `{"status":"ok"}`. It confirms that the web route responds; it does not check the database, Redis, Firebase, storage, paid checkout or provider delivery. Check service status and create your own development account to verify sign-in separately.

## Optional workflows

Use free ticket types to exercise a booking without a payment account. Email can stay on SMTP/Mailpit so notifications remain inside your local inbox. Keep WhatsApp disabled until you deliberately configure and consent to a test send.

Seeding is optional. Inspect the current seed implementation before running it against a disposable development database. Seeded application records do not create Firebase sign-in accounts. [Integration requirements](integrations.md) explain the extra configuration for paid checkout and outbound providers.
