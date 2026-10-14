# Raunak

India-first event ticketing SaaS. Raunak is the confirmed brand; Eventra was the working codename. Phase 1 implementation is in progress. Read `project.md` for product scope and `context.md` for architecture.

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

M0–M5 are implemented and checked locally. M2 has Firebase sign-in, sessions, workspace creation, invitations, role changes, removals, and tenant checks; external Firebase sign-in still needs project credentials for a manual check. Organizers can create a draft, upload media, add ticket types, assign staff, publish, duplicate, and soft-delete unused drafts. The public landing, discovery, event page, social image, and sitemap are live. Checkout, delivery, scanner, and analytics remain in later milestones.

## Decisions

Next.js Cache Components are disabled for now because authenticated pages resolve cookie and database data at request time. The public pages can be cached separately when built.

## Media worker

Run `pnpm worker` alongside `pnpm dev`. Images are uploaded directly to S3-compatible storage through five-minute presigned URLs, then processed by the Redis-backed worker. LocalStack starts with an `eventra` bucket, browser CORS, and public access only for generated variants. Originals stay private. For AWS S3 or Cloudflare R2, set the `S3_*` variables and configure the same CORS and variant-read policy on that bucket.

The image limit is 20 per event and 10 MB per file. The worker verifies the actual file format before decoding and creates thumb, card, hero, and OG sizes in AVIF, WebP, and JPEG. HEIC/HEIF uses a dedicated decoder. `pnpm test` exercises all six accepted format families against the local S3 service.

A deletion that races an already-running conversion can leave an unreferenced variant in storage. A durable deletion outbox is needed before using this for sensitive uploads; event images should be treated as public assets.

## Organizer event flow

Sign in, create a workspace, then open its Events page. Create a draft with local date and time in the selected event timezone. Add a poster on Media, add ticket types on Tickets, and publish from Overview. Published events require a processed poster, a future start time, and at least one ticket type. A capacity, when set, limits the sum of ticket inventory. Event Managers only see events assigned to them; Check-in Staff only see assigned attendee lists. Published unlisted events open by direct URL but are excluded from discovery and the sitemap.


## Raunak landing and account UI

The landing page is now the visual foundation for the company: paper, ink, vermilion, deep green, Instrument Serif, Geist and Geist Mono. Login and signup share the same layout, tokens, theme, forms and ticket motif. See `docs/brand.md` for reuse rules.

Implemented landing sections: floating navigation and mobile menu, ticket hero with tilt and scroll tear, event marquee, desktop scroll story with a mobile fallback, six interactive feature demos, live WhatsApp customizer, pricing, product facts, accessible FAQ, final ticket invitation, and footer with IST clock, theme toggle, back-to-top and ticket confetti. All sample events are fictional; sample analytics is labeled.

Run `pnpm dev` and open `/`. `/login` and `/signup?intent=organizer` use the new identity. `/style-guide` is development-only. `pnpm test:e2e` checks marketing interactions and generates screenshots under `artifacts/landing`. Set `PLAYWRIGHT_BASE_URL=http://localhost:3001` to check an existing production server. The landing itself does not need a database or external credentials. Discovery and the attendee wallet use the existing database.

Pricing defaults in `src/config/pricing.ts` are proposals: first event ₹0 platform fee; later paid tickets 2% + ₹3. Gateway processing charges apply separately. Confirm the commercial values and implement eligibility in checkout before launch. FAQ and structured data derive their price wording from this config.

Privacy and terms pages are drafts. The business entity, support/privacy contact, retention schedule and jurisdiction need legal review before launch. The Contact page points event attendees toward their organizer; no unverified support mailbox is advertised.

Backend checkout work is preserved in the Git stash named `WIP checkout before Raunak landing`, following the request to finish the UI first. The marketing page previews the intended checkout, messaging and scanner behavior; those backend milestones still need completion and provider credentials.

Motion versions: Lenis 1.3.26, GSAP 3.15.0, Motion 14.2.0. Heavy GSAP scroll code is loaded only on desktop when reduced motion is off. Marketing styles remain scoped so the dashboard can adopt the new foundation deliberately.

### UI verification

Production build checks passed: lint, TypeScript, 16 unit/integration tests, and four Playwright marketing tests. Screenshots cover 375, 768 and 1440 widths in light and dark themes, reduced motion, landing interactions, login and signup. The public navigation and social image are checked, and core content is visible with JavaScript disabled.

Local Lighthouse 13.5.0 mobile audit: Performance 95, Accessibility 100, Best Practices 100, SEO 100; CLS 0. Simulated mobile LCP was 2.8s, so the brief's stricter 2.5s LCP target remains a deployment performance follow-up. Reports and screenshots are generated in `artifacts/landing` and are not committed. External Firebase login and payment-provider completion require credentials and are not claimed as verified by these UI tests.
