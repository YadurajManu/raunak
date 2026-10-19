# Development and testing

Use the pinned pnpm workspace and the installed framework documentation. The repository contains the Next.js web app, shared WhatsApp contracts and a separate optional gateway service.

## Daily workflow

Start local services with `docker compose up -d`, generate the Prisma client after schema changes, and run `pnpm dev` plus `pnpm worker` in separate terminals. Keep `.env` local and use development Firebase/provider accounts.

The installed Next.js version is 16.4.0. Read the relevant guide under `node_modules/next/dist/docs/` before changing routes, layouts, caching or framework APIs; repository `AGENTS.md` explicitly requires this.

## Repository structure

| Path | Purpose |
| --- | --- |
| `src/app/` | App Router pages, layouts and API routes |
| `src/components/` | Shared product, marketing and documentation UI |
| `src/server/` | Auth, access control, business services and provider implementations |
| `src/lib/` and `src/config/` | Shared helpers and product configuration |
| `prisma/` | Schema, migrations and development seed implementation |
| `worker/` | BullMQ workers, queues and artwork processing |
| `services/wa-gateway/` | Optional long-lived linked WhatsApp service |
| `packages/wa-contracts/` | Gateway request/response contracts |
| `docs/public/` | Explicitly published Markdown documentation |
| `tests/` | Unit, integration and Playwright coverage |

## Run checks

```bash
pnpm exec prisma generate
pnpm exec next typegen
pnpm typecheck
pnpm lint
pnpm exec vitest run tests/unit
pnpm build
```

`pnpm test` runs the complete Vitest suite, including integration files that need local dependencies. Unit-only checks are useful early feedback, not a substitute for the relevant database/provider integration tests.

## Integration tests

Integration tests create records in the database selected by `DATABASE_URL` and may use Redis, storage and Mailpit. Read the individual test file before running it, supply the required local services/secrets, and keep the environment isolated from customer data.

```bash
pnpm exec vitest run tests/integration/checkin.test.ts
pnpm exec vitest run tests/integration/checkout.test.ts
```

The payment tests inject provider behavior. They cover application state and failure handling; they do not prove that a live merchant account can charge, refund or settle funds.

## Browser checks

```bash
pnpm exec playwright install chromium
pnpm test:e2e
```

Playwright normally starts or reuses the development web server at port 3000. `PLAYWRIGHT_BASE_URL` can point to a separately running **local test application**; do not point write-capable fixtures at a deployment with customer records. Some browser tests use local preview routes or intercepted data and should be described as such.

Check mobile and desktop widths, both themes, keyboard navigation and reduced motion for interface changes. Reports and screenshots belong in the ignored artifact/test-output directories. Public documentation images use fictional sample records and no usable admission QR.

## Themes and shared UI

Reuse `src/app/theme-tokens.css`. Small accent text uses `--accent-ink`; the brighter coral is appropriate for a filled action with the corresponding foreground token. Maintain shared component behavior rather than duplicating navigation or auth.

Documentation has a dedicated `/docs` layout so it can render without an application session or provider clients. Documentation styles should be scoped to that surface and should not alter event, ticket or organizer screens.

## Before a contribution

Keep changes focused and preserve tenant boundaries, ticket ownership, private storage access and payment idempotency. Record which checks actually ran, which require credentials/services, and any observed failures. Never replace an unavailable integration with a claim that a mock is production verification.
