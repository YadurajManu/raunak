# Codex Initial Prompt — Build Eventra Phase 1 (MVP)

You are a senior full-stack engineer building a production-grade, multi-tenant event ticketing SaaS from scratch in this repository. Work autonomously and make sensible decisions instead of asking questions. Record any non-obvious decision in `README.md` under "Decisions".

## Read first

1. `project.md` — what we are building and why (product source of truth).
2. `context.md` — how to build it: stack, architecture, data model, flows, security, env vars (technical source of truth).

If anything conflicts, `project.md` wins on product behaviour and `context.md` wins on technical choices. Before coding against Next.js, Firebase, Cashfree, Meta WhatsApp Cloud API, Prisma or BullMQ, check their current documentation and pin versions. Do not rely on memory of APIs.

## Operating rules

- Build **Phase 1 only** (see `project.md` §5). Do not build Phase 2/3 features, but design the schema so they can be added without rewrites.
- Create `AGENTS.md` first: project summary, commands (dev, build, lint, typecheck, test, db:migrate, db:seed, worker), folder conventions, and the rules in this section.
- Work **milestone by milestone** (below). After each milestone: run typecheck, lint and tests, fix everything, commit with a conventional message, then continue.
- No placeholders, no fake data in production code paths, no "TODO later" for things in scope. Seed data belongs only in `prisma/seed.ts`.
- All business logic in `src/server/*` services; route handlers and server actions stay thin. Providers (payments, email, WhatsApp, storage) are behind interfaces with a mock implementation for tests.
- Validate every input with Zod. Enforce RBAC and tenant isolation (`orgId`) on every mutation and query. Money is integer paise.
- Never commit secrets. Provide a complete `.env.example` and a zod-validated `src/lib/env.ts` that fails fast with a clear message.
- UI must follow `project.md` §7 and `context.md` §7: minimal, calm, mobile-first, with loading, empty and error states on every view. No Lorem ipsum.
- Prefer boring, well-known libraries. Keep dependencies lean.

## Milestones

**M0 — Scaffold and tooling**
Next.js + TypeScript strict + Tailwind + shadcn/ui, ESLint/Prettier, Vitest, Playwright, `docker-compose.yml` (postgres, redis, minio, mailpit), env validation, base layout, theme (light/dark), `AGENTS.md`, `README.md` skeleton.
*Done when:* `docker compose up -d && pnpm dev` runs and a health route returns OK; lint, typecheck and a sample test pass.

**M1 — Database**
Full Prisma schema for all Phase 1 tables in `context.md` §4 (plus Phase 2 tables stubbed only if trivial), indexes, constraints (including the ticket inventory CHECK), migrations, and `seed.ts` (one org, 1 owner, 2 events with images and ticket types).
*Done when:* `pnpm db:migrate && pnpm db:seed` works on a clean database.

**M2 — Auth, workspaces, RBAC**
Firebase email/password + Google sign-in, email verification, reset password, session cookie flow (§5.1), user mirroring, org onboarding, invites (create, email, accept), roles, `requireOrgRole` / `requireEventAccess`, org switcher, audit log entries.
*Done when:* two different users in two orgs cannot access each other's data (covered by integration tests) and invites work end to end.

**M3 — Media pipeline**
Presigned upload, confirm, worker processing (magic-byte validation, EXIF strip, HEIC/HEIF conversion, variants, blurhash), image manager UI (multi-upload with progress, drag to reorder, alt text, delete, set poster/cover). People/lineup editor with photos.
*Done when:* JPG, PNG, WebP, AVIF, GIF and HEIC uploads all produce working variants; a disguised non-image file is rejected.

**M4 — Events and tickets (organizer side)**
Event list, create/edit wizard (details, media, tickets), ticket types with sale windows and limits, publish/unpublish/cancel, duplicate, slug generation, assignees (Team tab), event dashboard tabs with real data where available.
*Done when:* an organizer can build and publish a complete event from the UI.

**M5 — Public site**
Landing page, `/discover` (search, city, category, date filters), `/e/[slug]` (hero, facts bar, About, Lineup, Gallery, Venue, ticket selector), SEO metadata, JSON-LD `Event`, dynamic OG image, sitemap.
*Done when:* an unlisted event is reachable only by link; a published event shows a correct social preview.

**M6 — Checkout and Cashfree**
Cart validation, atomic inventory holds, order creation, Cashfree order + checkout, signature-verified idempotent webhook, server-side return page, failure/expiry handling, `expire-orders` worker job, late-payment edge case, free-ticket path, platform fee calculation and display. Cashfree provider has a mock for tests.
*Done when:* integration tests prove no overselling under concurrent checkouts, duplicate webhooks are harmless, and the sandbox flow completes manually.

**M7 — Tickets and delivery**
Ticket issuance, signed QR (§5.3), PDF ticket generation in the worker, ticket email with attachment, `/t/[token]` page, `/my-tickets`, resend button, order detail pages.
*Done when:* a paid order produces correct tickets, QR verification unit tests pass, and the email renders correctly in Mailpit.

**M8 — Notifications and WhatsApp automations**
Queue pipeline (§5.4), template resolution (event > org > system), safe renderer with the variable list, email provider, WhatsApp provider interface with `meta-cloud` and `mock` (and `wwebjs` behind the dev flag), delivery-status webhook, reminder scheduling, delivery log UI with filters and retry. **Messages** dashboard: per-trigger/per-channel toggles, slot editor with live preview, "send test to me", reset to default.
*Done when:* editing a template in the dashboard changes the next message; failed sends show a readable reason and can be retried.

**M9 — Check-in and team**
Phone-friendly scanner (camera QR, torch toggle, big Valid/Invalid states, haptic/sound), manual search check-in, double-scan protection, check-in history, role-restricted views for CHECKIN and MANAGER staff, team management UI with event assignment.
*Done when:* the scanner flow works on a mobile viewport and a Check-in Staff user sees only assigned events.

**M10 — Dashboards, polish, hardening**
Organizer overview (revenue, tickets, check-in rate, sales chart, recent orders), attendees and orders tables with CSV export, rate limiting, security headers, empty/error states audit, accessibility pass, Playwright golden-path test, README completion (setup under 10 minutes, env guide, worker, webhook testing with a tunnel, provider switching).
*Done when:* the golden path in `project.md` §8 passes end to end.

## Acceptance

All 10 steps of the golden path in `project.md` §8 work. `pnpm lint`, `pnpm typecheck`, `pnpm test` and `pnpm test:e2e` all pass on a clean clone using only `.env.example` values for local services plus sandbox credentials.

## Out of scope for this run

Coupons, dashboard refunds UI, automated payouts, event tasks, custom registration questions, waitlist, guest checkout, per-org WhatsApp number connection, Meta template submission from the UI, public API, native apps.

## Final report (when finished)

Reply with: what was built per milestone, how to run everything, env vars I must fill in (with where to get each), anything intentionally deferred, known risks (especially WhatsApp template approval and Cashfree production onboarding), and the 5 best next features to build in Phase 2.