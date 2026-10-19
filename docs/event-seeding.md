# Raunak demo event seeding

`seed-raunak-events.js` runs on Node 24 using the installed `pg` and `dotenv`
dependencies. The old seed entry point now uses this same safe implementation;
it no longer creates a synthetic Firebase owner.

```sh
pnpm install --frozen-lockfile
pnpm db:migrate
node seed-raunak-events.js --validate
```

## Catalogue

12 **[DEMO]** listings across Ahmedabad, Bengaluru, Jaipur, Gurugram, Delhi,
Lucknow, Rishikesh, Hyderabad, Udaipur, Pune, Noida and Greater Noida. Each has a
summary, detailed Markdown description, agenda, FAQs, rules, illustrative amenities,
booking instructions, refund policy, neighbourhood map pin, three INR ticket tiers
and four photographs (poster plus three gallery images).

No venue, performer, speaker, sponsor or institution is represented as confirmed.
Titles, descriptions, venues, ticket descriptions and image alt text identify the
content as illustrative. State, tags, agenda and FAQs use existing description/
address fields; no unrelated database migration is required.

Prices range from free RSVP to ₹2,999. `pricePaise` is an integer (₹399 = 39900).
Inventory across tiers equals event capacity. **Every ticket admits one person.**
Couples/group passes are omitted because the existing QR/capacity model has no
multi-admission ticket units; the existing checkout supports buying several
individual tickets in one order.

## Existing organizers and configuration

Defaults are `yadurajsingham@gmail.com` and `yaduraj.enc@gmail.com`, six events
each. Both must already have signed in through Firebase and own an active Raunak
workspace. Actual user UUIDs and authentication linkage are read from the database.
No users, memberships, authentication records or workspaces are created/updated.

Optional values in a private `.env`:

```dotenv
DATABASE_URL=postgresql://user:password@localhost:5433/raunak_preview
APP_URL=http://localhost:3000
CASHFREE_ENV=sandbox
SEED_ORGANIZER_EMAILS=yadurajsingham@gmail.com,yaduraj.enc@gmail.com
# Required when a user owns multiple workspaces. Values must be actual owned UUIDs.
SEED_ORG_IDS={"yadurajsingham@gmail.com":"EXISTING-WORKSPACE-UUID","yaduraj.enc@gmail.com":"EXISTING-WORKSPACE-UUID"}
# Choose a future date and keep it constant across preview runs.
SEED_START_DATE=2027-01-15
```

More comma-separated organizer emails are supported, distributed round-robin.
Missing accounts/workspaces fail with instructions to sign in/create a workspace
through Raunak. Dates default to 30 days from execution, with events spaced three
days apart; all dates use Asia/Kolkata. Never commit credentials or dump `.env`.

## Commands

```sh
# Offline validation, no database connection.
node seed-raunak-events.js --validate
# Also check remote image availability, still without a database connection.
node seed-raunak-events.js --validate --check-images
# Read-only ownership/schema/collision checks and proposed changes.
pnpm db:seed --dry-run
# Transactionally insert drafts after checking all image URLs.
pnpm db:seed --apply
# Verify actual rows, ownership, inventory and image/tier counts.
pnpm db:seed --verify
```

Example dry-run output shape (workspace IDs come from your database):

```text
Plan: 12 demo events, 36 INR ticket tiers, 48 images. DRAFT / excluded from public discovery.
WOULD CREATE raunak-demo-garba → yadurajsingham@gmail.com / workspace <existing UUID>
WOULD CREATE raunak-demo-music → yaduraj.enc@gmail.com / workspace <existing UUID>
...10 more listings...
Read-only run complete; no writes committed.
```

The real default local dry run during implementation stopped because these two
accounts are absent locally. This example does not claim they or their events were
inserted. Integration tests use disposable local fixture accounts only.

## Publishing and payment safety

Drafts have `isTest=true`, remain hidden publicly and cannot accept checkout.
For discovery/checkout testing in a **local preview**:

```sh
# Local app/database, non-production NODE_ENV and CASHFREE_ENV=sandbox required.
SEED_ALLOW_PUBLISH=true node seed-raunak-events.js --dry-run --publish
SEED_ALLOW_PUBLISH=true node seed-raunak-events.js --apply --publish
```

Public preview rows use `isTest=false` so the existing public queries work without
weakening test-event exclusion. They retain `[DEMO]` labels and `raunak-demo-`
slugs. Checkout independently rejects those slugs unless the running application
uses `CASHFREE_ENV=sandbox`, including retries of existing orders.

The gateway is **Cashfree**, not Razorpay. Use actual Cashfree sandbox credentials
in the app for gateway acceptance testing. Existing backend fees and final totals
are preserved; no invented tax rules. Free RSVP uses the existing zero-total path
without calling Cashfree. The seed creates no bookings, payments, QR admissions,
settlements, refunds or notifications.

Publishing is refused for remote databases, non-local APP_URLs or production
NODE_ENV, even with opt-in. Remote/production **draft insertion or cleanup** also
requires `SEED_ALLOW_PRODUCTION_DRAFTS=true`; it cannot enable public publishing.
No production writes happen automatically.

## Idempotency, rollback and cleanup

Deterministic UUIDs identify all event/image/ticket-type rows. Transactions use an
advisory lock; ID, slug, marker and current workspace ownership are checked before
writes. SQL values are parameterized. Any error rolls back the entire operation.
Existing matching rows are kept without overwriting organizer edits, dates, sale
counters or booking history. Re-running does not promote drafts to public.
Verification reports structural differences instead of silently repairing them.

To change draft/public mode or refresh dates, clean up unbooked samples first:

```sh
node seed-raunak-events.js --cleanup --dry-run
node seed-raunak-events.js --cleanup --apply
```

Cleanup targets only catalogue UUIDs with matching marker, slug and ownership.
It deletes their event/image/type rows, never users/workspaces. If **any order or
ticket** exists, including failed/expired orders, the entire cleanup is refused.
Archive booked samples through Raunak to preserve payment/admission history.
CDN photographs are never deleted.

## Photos

Default photographs use [Pexels](https://www.pexels.com/license/) and four Garba
images from Wikimedia Commons with source-specific CC BY-SA licences. Linked
credits, original source pages and licence URLs are included in event descriptions.
Photos illustrate the activity; they do not depict a confirmed venue or lineup.
Commons thumbnails are resized without content changes. Pexels variants request
responsive crops using existing `thumb`, `card`, `hero` and `og` conventions.
No media worker jobs or fake local uploads are created; `sizeBytes=0` identifies
unmeasured externally hosted media.

Remote hosts may rate-limit or remove photos. Apply checks image availability and
fails before writes when a source is unavailable. For reliable delivery, mirror
the corresponding licensed photographs to your own CDN:

```dotenv
SEED_IMAGE_CDN_BASE=https://cdn.example.com/raunak-demo
```

Files: `<base>/<key>/1.jpg` through `4.jpg`, for keys `garba`, `music`, `pottery`,
`meetup`, `art`, `food`, `yoga`, `tech`, `photography`, `coding`, `comedy`, `festival`.
Preserve credits/CC BY-SA terms when mirroring. If replacing images, update the
catalogue's source, credit and licence too. CDN mode reuses one JPEG per photo at
all variant sizes; optimize assets before hosting them.

## Verification

```sh
pnpm exec vitest run tests/unit/seed-raunak-events.test.ts tests/integration/seed-raunak-events.test.ts tests/integration/checkout.test.ts
pnpm typecheck
pnpm exec eslint seed-raunak-events.js prisma/seed.ts src/server/checkout/service.ts tests/unit/seed-raunak-events.test.ts tests/integration/seed-raunak-events.test.ts
pnpm build
```

Integration tests require a local disposable database with migrations applied.
They verify mid-insert rollback, dry run, ownership, 6/6 dashboard distribution,
idempotency, image/tier records, public query visibility, free RSVP, paid confirmation
with a mock provider, duplicate confirmation handling, production-payment rejection
and cleanup refusal after bookings. Image availability is mocked in database tests.
Mock confirmation is not evidence of an actual Cashfree sandbox transaction.

The homepage is a marketing page without a database event-card section. This task
does not add unrelated homepage UI. Discover and event pages already consume the
event/image/ticket queries populated by the catalogue. Real-user authentication
and live sandbox credentials remain prerequisites for manual booking acceptance.
