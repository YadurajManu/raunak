# Eventra — Technical Context

Source of truth for *how* to build. Product intent lives in `project.md`.

## 1. Stack

| Layer | Choice |
|---|---|
| Framework | Latest stable Next.js (App Router) + TypeScript (strict) |
| UI | Tailwind CSS + shadcn/ui + lucide-react; React Hook Form + Zod; TanStack Query for client data |
| Database | PostgreSQL 16 via Prisma ORM (migrations checked in) |
| Auth | Firebase Authentication (client SDK) + `firebase-admin` for server verification and session cookies |
| Payments | Cashfree PG: `cashfree-pg` (server) + `@cashfreepayments/cashfree-js` (checkout) |
| Storage | S3-compatible (AWS S3 or Cloudflare R2 in prod, MinIO locally) via `@aws-sdk/client-s3` presigned URLs |
| Image processing | `sharp` (resize, convert, strip EXIF, blurhash) |
| Queue / cache | Redis + BullMQ; separate worker process |
| Email | Provider interface; Resend default, SES/SMTP alternative; React Email templates |
| WhatsApp | Existing Meta Cloud API; opt-in Baileys gateway extension in development, mock engine for tests; see `docs/whatsapp-gateway.md` |
| QR / PDF | `qrcode` + `@react-pdf/renderer` |
| Phone numbers | `libphonenumber-js`, default region IN, store E.164 |
| Tests | Vitest (unit/integration), Playwright (e2e) |
| Local dev | `docker-compose.yml` with postgres, redis, minio, mailpit |

Pin exact versions and check current docs for Next.js, Firebase, Cashfree and Meta before coding against them. Do not rely on memory of APIs.

## 2. Architecture

```
Browser ──► Next.js (App Router: pages, server actions, route handlers)
              │        │            │
              │        │            └─► Cashfree (create order) ◄── webhook ──┐
              │        └─► PostgreSQL (Prisma)                               │
              ├─► Firebase Auth (identity)                                   │
              ├─► S3/R2 (presigned uploads, public read via CDN)             │
              └─► Redis ◄──────── BullMQ ──────► Worker process              │
                                                  ├─ ticket PDF/QR          │
                                                  ├─ email provider         │
                                                  ├─ WhatsApp provider ─► Meta Cloud API
                                                  ├─ reminders (delayed jobs)
                                                  └─ order-hold expiry
```

Rules: route handlers/server actions stay thin and call services in `src/server/*`. All business logic lives in services. Providers (payments, email, WhatsApp, storage) sit behind interfaces so they can be swapped and mocked.

## 3. Repo layout

```
.
├─ AGENTS.md                 # conventions + commands (create it)
├─ project.md  context.md  prompt.md
├─ docker-compose.yml  .env.example  README.md
├─ prisma/  schema.prisma  migrations/  seed.ts
├─ src/
│  ├─ app/
│  │  ├─ (marketing)/        # landing, pricing
│  │  ├─ (public)/           # /discover, /e/[slug], /t/[token], /my-tickets
│  │  ├─ (auth)/             # /login, /signup, /accept-invite/[token]
│  │  ├─ dashboard/          # see §9
│  │  └─ api/                # webhooks/cashfree, webhooks/whatsapp, uploads/presign, checkin
│  ├─ components/ (ui/, dashboard/, public/, forms/)
│  ├─ emails/                # React Email templates
│  ├─ lib/                   # env.ts (zod), money.ts, dates.ts, phone.ts, crypto.ts
│  └─ server/
│     ├─ auth/ rbac/ db/
│     ├─ orgs/ events/ tickets/ orders/ payments/ media/ checkin/ notifications/
│     └─ providers/ { payments/, email/, whatsapp/, storage/ }
├─ worker/  index.ts  queues.ts  jobs/*
└─ tests/   unit/  integration/  e2e/
```

## 4. Data model (PostgreSQL)

Conventions: UUID primary keys, `timestamptz` everywhere, money as integer **paise** (`Int`), `createdAt/updatedAt` on all tables, soft delete (`deletedAt`) for events, enums for statuses, FK indexes, unique constraints where noted.

- **User** — id, firebaseUid (unique), email (unique), name, phone, avatarKey
- **Organization** — id, name, slug (unique), logoKey, supportEmail, supportPhone, brandColor, platformFeeBps, platformFeeFixedPaise, feeMode (ABSORB | PASS_TO_BUYER), status
- **OrganizationMember** — orgId, userId, role (OWNER | ADMIN | MANAGER | CHECKIN | FINANCE), status; unique (orgId, userId)
- **Invite** — orgId, email, role, tokenHash, expiresAt, acceptedAt
- **Event** — id, orgId, slug (unique), title, summary, description, category, status (DRAFT | PUBLISHED | CANCELLED | ENDED), visibility (PUBLIC | UNLISTED), mode (IN_PERSON | ONLINE | HYBRID), startsAt, endsAt, timezone, venueName, address, city, lat, lng, onlineUrl, capacity, refundPolicy, publishedAt, deletedAt
- **EventImage** — id, eventId, kind (POSTER | COVER | GALLERY), storageKey, variants (jsonb), width, height, blurhash, alt, mime, sizeBytes, sortOrder
- **EventPerson** — id, eventId, name, title, bio, photoKey, links (jsonb), sortOrder
- **EventStaff** — eventId, userId, role (MANAGER | CHECKIN); unique (eventId, userId). This is the assignee table.
- **TicketType** — id, eventId, name, description, pricePaise, quantityTotal, quantitySold, quantityHeld, saleStartsAt, saleEndsAt, minPerOrder, maxPerOrder, isHidden, sortOrder. CHECK (quantitySold + quantityHeld <= quantityTotal)
- **Order** — id, eventId, buyerId, status (PENDING | PAID | FAILED | EXPIRED | CANCELLED | REFUNDED | PARTIALLY_REFUNDED), subtotalPaise, discountPaise, feePaise, taxPaise, totalPaise, expiresAt, cashfreeOrderId (unique), paymentSessionId, buyerName, buyerEmail, buyerPhone, idempotencyKey (unique)
- **OrderItem** — orderId, ticketTypeId, quantity, unitPricePaise
- **Ticket** — id, orderId, eventId, ticketTypeId, code (short human-readable, unique), holderName, holderEmail, holderPhone, status (VALID | USED | CANCELLED | REFUNDED), checkedInAt, checkedInById
- **Payment** — id, orderId, cfPaymentId, method, status, amountPaise, rawPayload (jsonb), paidAt
- **Refund** — id, paymentId, amountPaise, status, cfRefundId, reason (table in MVP, UI in Phase 2)
- **WebhookEvent** — id, provider, idempotencyKey, payload (jsonb), status, processedAt; unique (provider, idempotencyKey)
- **MessageTemplate** — id, orgId, eventId (nullable), channel (EMAIL | WHATSAPP), trigger, subject, body, language, providerTemplateName, providerStatus, slots (jsonb), isEnabled
- **NotificationLog** — id, orgId, eventId, orderId, ticketId (nullable), channel, trigger, toAddress, templateId, status (QUEUED | SENT | DELIVERED | READ | FAILED), providerMessageId, error, attempts, scheduledAt, sentAt; unique (ticketId or orderId, trigger, channel) for idempotent reminders
- **AuditLog** — id, orgId, actorId, action, entityType, entityId, meta (jsonb), ip
- Phase 2 tables (design now, migrate later): **Coupon**, **EventTask**, **TaskAssignee**, **Payout**. The former WhatsAppConnection placeholder is replaced by the WhatsAppSession/WhatsAppSuppression gateway migration; see `docs/whatsapp-gateway.md` for implementation status.

## 5. Key flows

### 5.1 Auth
1. Client signs in with Firebase, sends ID token to `POST /api/auth/session`.
2. Server verifies with `firebase-admin`, creates a session cookie (`httpOnly`, `secure`, `sameSite=lax`, ~5 days), upserts `User` by `firebaseUid`.
3. Every server action and route handler resolves the user from the cookie, then runs `requireOrgRole(orgId, roles)` or `requireEventAccess(eventId, roles)`. Never trust client-provided org or role.

### 5.2 Checkout and payment (never oversell, never trust the client)
1. `POST /api/checkout` (idempotency key required) validates the cart with Zod.
2. In one transaction, reserve inventory atomically:
   `UPDATE ticket_types SET quantity_held = quantity_held + :q WHERE id = :id AND quantity_total - quantity_sold - quantity_held >= :q` (0 rows updated means sold out). Create `Order(PENDING, expiresAt = now + 10 min)` and items.
3. Free order: issue tickets immediately, skip Cashfree.
4. Paid order: server creates the Cashfree order (our order id as `order_id`, buyer details, `return_url`, `notify_url`) and returns `payment_session_id`; the client opens Cashfree checkout.
5. `POST /api/webhooks/cashfree`: read the **raw body**, verify signature (`x-webhook-signature` over timestamp + raw body, HMAC-SHA256, timing-safe compare; confirm exact scheme in current Cashfree docs), insert `WebhookEvent` with unique key (duplicate means return 200 and stop), then process in a transaction.
6. On success: order PAID, hold converted to sold, create `Payment`, issue tickets, enqueue notifications.
7. `return_url` page fetches order status **server-side** from Cashfree; it never trusts query params.
8. Failure/expiry: worker job `expire-orders` (every minute) releases holds and marks EXPIRED/FAILED.
9. Late success after expiry: try to re-acquire inventory; if impossible, auto-refund through Cashfree and notify the buyer.

### 5.3 Tickets and QR
- Token: `v1.<ticketId>.<base64url(HMAC_SHA256(TICKET_SIGNING_SECRET, "v1." + ticketId + "." + eventId))>`.
- QR encodes `${APP_URL}/t/<token>`. A phone camera opens a read-only ticket page showing status; only the scanner can check in.
- PDF ticket: event poster, title, date/venue, holder, ticket type, QR, short code.
- `POST /api/checkin`: verify HMAC, verify caller has CHECKIN/MANAGER+ on that event, then atomic
  `UPDATE tickets SET status='USED', checked_in_at=now(), checked_in_by=:uid WHERE id=:id AND status='VALID' RETURNING *`.
  No row returned means respond "already used" with time and who scanned.

### 5.4 Notifications pipeline
`enqueueNotification(trigger, context)` → resolve template (**event-level > org-level > system default**) → render with a safe variable engine (no code execution; HTML-escape for email) → write `NotificationLog(QUEUED)` → BullMQ job per channel → provider send → update log. Retries: exponential backoff, 5 attempts, then dead-letter and mark FAILED. Reminders: delayed jobs scheduled when tickets are issued and rescheduled if the event time changes; idempotent via the unique log key.

**Template variables:** `{{attendee_name}}` `{{event_title}}` `{{event_date}}` `{{event_time}}` `{{venue}}` `{{city}}` `{{ticket_type}}` `{{quantity}}` `{{order_id}}` `{{amount_paid}}` `{{ticket_url}}` `{{organizer_name}}` `{{support_contact}}` `{{custom_note}}`

**Triggers:** `ORDER_CONFIRMED`, `TICKET_ISSUED`, `PAYMENT_FAILED`, `REMINDER_24H`, `REMINDER_2H`, `EVENT_UPDATED`, `EVENT_CANCELLED` (Phase 2: `REFUND_PROCESSED`, `CHECKIN_THANKS`).

**WhatsApp provider interface:**
```ts
interface WhatsAppProvider {
  sendTemplate(input: { to: string; templateName: string; language: string; params: string[]; mediaUrl?: string }): Promise<{ providerMessageId: string }>;
  sendText(input: { to: string; body: string }): Promise<{ providerMessageId: string }>; // only inside the 24h session window
  parseWebhook(req: Request): Promise<DeliveryStatusUpdate[]>;                            // sent/delivered/read/failed
}
```
- `meta-cloud` (default): business-initiated messages **must** use Meta-approved templates with positional params. Map named variables to positional `{{1}}…{{n}}` at send time.
- MVP customization: the platform ships a fixed set of approved templates that include customizable slots (for example `custom_note`, `custom_footer`). Organizers edit slot text, toggle triggers per event, preview, and send a test. Full custom body submission through the Meta Message Templates API is Phase 2.
- `wwebjs`: unofficial, dev/testing only, behind `WHATSAPP_PROVIDER=wwebjs`, runs as a separate worker, with a visible warning in the README about ban risk and ToS. Never the default.
- Always normalize phone numbers to E.164, and skip WhatsApp (fall back to email only) when the number is missing or invalid.

### 5.5 Media pipeline
1. Client requests `POST /api/uploads/presign` (auth + RBAC + size/mime allowlist) and uploads directly to storage under `orgs/{orgId}/events/{eventId}/original/{uuid}`.
2. Client calls confirm; the worker downloads, validates by **magic bytes** (not the extension), strips EXIF, converts HEIC/HEIF, and writes variants: `thumb 320`, `card 640`, `hero 1280`, `og 1200×630`, in AVIF/WebP plus JPEG fallback. Computes blurhash, width, height.
3. Limits: 10 MB per file, 20 images per event (configurable). Public read via CDN/bucket policy; originals stay private.
4. Use a `next/image` custom loader or plain `<picture>` with the stored variants.

## 6. Security and compliance

- Zod validation on every input; typed server actions; consistent error shape.
- RBAC helpers on every mutation and every query that returns org data (tenant isolation by `orgId` in all queries).
- Rate limiting (Redis, `rate-limiter-flexible`) on login-adjacent, checkout, scan and presign endpoints.
- Webhooks: raw-body signature check, timing-safe compare, idempotency table.
- Secrets in env only; any stored third-party token encrypted with AES-256-GCM (`ENCRYPTION_KEY`).
- Security headers and CSP; CSRF-safe (same-site cookies + origin checks on mutations).
- No PII or secrets in logs; mask phone/email in error reports.
- Audit log for team changes, event publish/cancel, template edits, exports.
- Keep PII minimal (India's DPDP Act); account deletion and data export are Phase 2.

## 7. UI system

- shadcn/ui components, Tailwind tokens in CSS variables, Geist or Inter font, 8px spacing scale, 12px radius, subtle borders over heavy shadows, one accent colour (default indigo, configurable), light and dark.
- Public event page: hero poster, key facts bar (date, venue, price from), tabbed or stacked sections (About, Lineup, Gallery, Venue, FAQ), sticky "Get tickets" bar on mobile.
- Checkout: right-hand drawer (desktop) or full-screen sheet (mobile): tickets → details → pay.
- Data tables: search, filters, column toggles, pagination, CSV export, row actions menu.
- Every list view has an empty state, a loading skeleton and an error state.

## 8. Environment variables (`.env.example` must list all, validated by `src/lib/env.ts`)

```
APP_URL=
DATABASE_URL=
REDIS_URL=

NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=

CASHFREE_ENV=sandbox            # sandbox | production
CASHFREE_APP_ID=
CASHFREE_SECRET_KEY=
CASHFREE_API_VERSION=           # pin per current docs

S3_ENDPOINT=
S3_REGION=
S3_BUCKET=
S3_ACCESS_KEY_ID=
S3_SECRET_ACCESS_KEY=
S3_PUBLIC_BASE_URL=

EMAIL_PROVIDER=resend           # resend | ses | smtp
RESEND_API_KEY=
EMAIL_FROM=

WHATSAPP_PROVIDER=meta-cloud    # meta-cloud | wwebjs (dev only)
WHATSAPP_CLOUD_TOKEN=
WHATSAPP_PHONE_NUMBER_ID=
WHATSAPP_WABA_ID=
WHATSAPP_WEBHOOK_VERIFY_TOKEN=

TICKET_SIGNING_SECRET=
ENCRYPTION_KEY=
```

## 9. Dashboard routes

```
/dashboard                          overview (revenue, sales, check-ins, recent orders)
/dashboard/events                   list + filters
/dashboard/events/new
/dashboard/events/[id]              tabs: Overview · Details · Media · Tickets · Attendees · Orders · Messages · Team · Check-in · Settings
/dashboard/orders
/dashboard/attendees
/dashboard/messages                 org-level templates + delivery logs
/dashboard/team                     members, invites, roles
/dashboard/settings                 org profile, integrations, (payouts placeholder)
/my-tickets                         attendee wallet
/t/[token]                          public read-only ticket page
```

## 10. Quality bar

- TypeScript strict, ESLint + Prettier, no `any` without a comment, no dead code.
- Service-layer unit tests for: inventory holds, ticket signing/verification, webhook idempotency, RBAC, template rendering.
- One Playwright e2e for the golden path (Cashfree mocked at the provider interface).
- Conventional commits, one commit per milestone at minimum.
- README with: setup in under 10 minutes, scripts, env guide, how to run worker, how to test Cashfree sandbox webhooks locally (tunnel), and how to switch providers.
