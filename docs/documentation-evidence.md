# Documentation implementation evidence

Audit date: 19 October 2026. This is a maintainer working table, deliberately excluded from the public documentation route map. “Source reviewed” means the named code was inspected for the described behavior; it is not remote provider or production acceptance.

| Claim | Source file / symbol | Implementation status | Verification in this documentation pass | Unresolved dependency |
| --- | --- | --- | --- | --- |
| Public brand is Raunak | `src/lib/constants.ts`, `src/app/theme-tokens.css`, `docs/brand.md` | Shared brand/tokens exist; package/database codename persists | Source reviewed; tokens checked before content | Browser rendering is checked separately by UI verification |
| Local setup uses Node 24 and pnpm 10.12.4 | `Dockerfile`, `package.json`, `pnpm-lock.yaml` | Pinned toolchain/workspace | Commands and versions source-reviewed | Full clean setup requires Docker/services and Firebase credentials |
| Local services and ports | `docker-compose.yml`, `docker/localstack-init.sh`, `.env.example` | Postgres 5433, Redis 6379, S3 9000, SMTP 1025, inbox 8025 | Compose/env alignment checked | Service reachability is not established by source review |
| Authentication uses Firebase session cookies | `src/server/auth/session.ts`, `src/server/auth/firebase-admin.ts`, `src/app/api/auth/session/route.ts` | Recent ID token → server cookie; 14-day persistent or browser-session cookie | Source reviewed | Actual Firebase project/provider/authorized-domain configuration |
| Guest checkout is unavailable | `src/app/api/checkout/route.ts`, `src/app/(marketing)/checkout/[slug]/page.tsx`, `src/app/(marketing)/my-tickets/recover/page.tsx` | Checkout requires authenticated user; recovery guides same-account sign-in | Route/page/service ownership traced | No guest ownership-verification implementation to describe |
| Platform publication moderation exists | `src/server/events/service.ts::submitEventForReview`, `src/server/admin/reviews.ts`, `src/app/api/admin/events/`, `src/server/auth/session.ts::requirePlatformAdmin` | Pending review, approve/change/reject/suspend/restore; exact UID allowlist | Submission, authorization and decision code reviewed; contradicts old README “not implemented” claim | Reviewer allowlist and operator policy; current review alert recipient is in server code |
| Discovery excludes unsuitable visibility/status | `src/server/public/events.ts::publicListing`, `discoverPage` | Public published non-test/non-deleted active-org upcoming results | SQL/query filters reviewed | Real published data and DB connectivity needed to demonstrate actual results |
| Ended events remain available by URL | `src/server/public/events.ts::publicEvent`, public event and checkout pages | Event page supports PUBLISHED/ENDED; checkout refuses ended events | Callers reviewed | No claim that past events enter upcoming Discover |
| Free/paid bookings differ | `src/server/checkout/service.ts::createCheckout` | Free order directly confirms/issues tickets; paid order reserves inventory and requests Cashfree session | Transaction, server totals and 20-minute hold reviewed | Live Cashfree account not exercised |
| Payment confirmation verifies webhook and amount | `src/server/checkout/webhook.ts`, `src/server/providers/payments/cashfree.ts`, `applyPayment` | Raw signature validation, schema/idempotency checks, amount matching and controlled late success/refund handling | Code traced; existing test files reviewed | Real charge, refund, webhook delivery and merchant settlement remain separate acceptance |
| Organizer split settlement is not implemented | `src/server/providers/payments/cashfree.ts`, checkout model/service | Merchant checkout/refund implementation has no organizer vendor/bank onboarding or split distribution | Provider methods/data model inspected | Merchant arrangements and alternative settlement design |
| PDFs/notifications are asynchronous | `src/server/tickets/delivery.ts`, `src/server/notifications/maintenance.ts::fulfilOrder`, `worker/index.ts` | Ticket queue prepares PDFs then enqueues notifications; maintenance recovers durable work | Queue/worker flow traced | Worker, DB/Redis/S3, secrets and provider settings |
| Email supports SMTP and Resend | `src/server/providers/email/provider.ts`, notification service/templates | Configured selection; PDF/QR attachments on ticket-issued email | Provider and attachment conditions reviewed | Verified remote sender and actual inbox acceptance; Mailpit is local only |
| Official Meta and unofficial linked gateway are distinct | `src/server/whatsapp/routing.ts`, provider implementations, `services/wa-gateway/`, `docs/whatsapp-gateway.md` | Separate configured routes; consent, templates/session and policies apply | Implementation/runbook reviewed | Approved Meta sender/template and real-phone gateway acceptance; existing checklist remains pending |
| Check-in is authorized and duplicate-safe | `src/server/checkin/service.ts`, `src/server/rbac/access.ts` | Signed scan/manual lookup, server eligibility, conditional transaction and audit log | Permission/status/update code traced; test file reviewed | Physical camera, lighting and venue network acceptance; no offline synchronization |
| Reviews verify booking ownership after event | `src/server/events/reviews.ts`, `src/app/api/events/[eventId]/reviews/route.ts` | One upsert per account/event; end-time/public status and eligible owned ticket/order checks | Source reviewed | Real review data; review verification is booking ownership, not attendance observed at the door |
| `/api/health` is not a dependency probe | `src/app/api/health/route.ts` | Returns static `{status: 'ok'}` | Implementation checked | Database/Redis/Firebase/provider checks must be performed separately |
| Public docs should avoid application session dependencies | Root layout vs `src/app/(marketing)/layout.tsx` | Marketing layout queries sessions/DB and adds product nav; dedicated docs layout avoids it | Layouts/font/theme source reviewed | New docs route/browser checks reported by implementation agent |

## Scope and reporting

No payment, outbound message, production database mutation or deployment was performed by this content audit. Existing private deployment/runbook details are not automatically included in public routes. The public guide set was explicitly authored under `docs/public/`; README and website describe implementation/configuration/verification boundaries consistently.

The pre-existing local `package.json` seed command pointed at an untracked script when inspected, while committed `HEAD` used `tsx prisma/seed.ts`. This task does not include that unrelated change. Public quick start does not require seeding, and the reference avoids advertising a seed command that could drift.

A reviewer should append actual local/browser check results to the delivery report. Do not convert this source-review table into a statement that live payments, remote delivery, settlement, phone acceptance or operational backups passed.

## Local verification — 20 October 2026

- Type checking, focused documentation lint and the production build passed.
- The unit suite passed: 116 tests across 45 files, including guide links, anchors, search and route allowlisting.
- All five documentation browser tests passed against the production build. Screenshots and accessibility checks cover 360, 390, 768, 1280 and 1440 pixels in light and dark themes; search, keyboard focus, mobile navigation, code copying, all 12 guides and unknown-route handling were exercised.
- Screenshots are local artifacts under `artifacts/docs/`. Public product previews use explicitly labelled sample data and are unavailable in production.
- A production preview served documentation with external service credentials unavailable. No live provider acceptance or database mutation was tested.
- Repository-wide lint remains blocked by unrelated existing `garba-match/` files. Database integration checks were not run because Docker was unavailable.
- No deployment was performed.
