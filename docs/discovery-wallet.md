# Discover and attendee wallet

## Delivered

- Discover uses parameterized PostgreSQL queries with 12-result pagination. Search covers titles, summaries, venues and organizer names. Suggestions are debounced and served from real published events with a short private HTTP cache.
- Filters: all cities, Indian city suggestions and recent selections, online/in-person/hybrid, permission-based nearby radius, India date shortcuts, custom date ranges, multiple categories, free/paid and starting-price range. Sorting supports soonest, newest and starting price. Filters persist in the URL across refresh/back navigation; changing a filter resets pagination.
- Responsive event cards have stable image dimensions, AVIF/WebP/JPEG responsive sources, lazy loading, organizer links, account-owned bookmarks and WhatsApp event sharing. Cards do not stretch across the page when only one or two events exist.
- `/saved` persists upcoming public saved events per account. Event and organizer pages link to real upcoming listings. Related events use matching category and city, not an intelligent/personalized ranking claim.
- `/my-tickets` queries tickets by authenticated `Order.buyerId`, with separate upcoming, past, cancelled and refunded tabs, search, date/newest sorting and pagination. Loading, signed-out, empty, search-empty and retrieval failure states are distinct.
- `/my-tickets/[id]` checks ownership again and provides each admission ticket's signed QR, holder, venue/directions, booking/payment link, calendar, private PDF and permitted resend actions. Used/cancelled/refunded/past tickets are not presented as ready for entry. Multiple admissions remain separate tickets within the booking.
- Publishing requires future valid dates, venue/city or online joining details as appropriate, a processed poster and ticket inventory. Image ratios, descriptive content, category and organizer contact receive advisory review warnings; subjective choices do not cause automatic rejection.
- Organizers can explicitly mark test events in Settings. Test listings are excluded from Discover, public event URLs, account suggestions and sitemap; checkout rejects them. Events with active bookings cannot become test events. Copies preserve the test flag.
- Authentication and public-event reads are deduplicated within a React server render. Private wallet/saved state is never cached across users.

## Existing integrations and limits

The installed payment provider is **Cashfree**, not Razorpay. Payment verification, idempotent issuance, signed QR verification, Resend ticket email and organizer operations remain in place.

Checkout requires a signed-in account; no guest checkout exists. Find a Booking therefore uses the original email/Google account and existing private booking email links. It does not introduce unverified reference/email lookup or guest linking. A future guest checkout must add verified ownership, rate-limited recovery tokens and an audit trail before linking bookings.

The schema has organizer-controlled PUBLISHED/DRAFT states, not a platform moderation approval queue. Public results require PUBLISHED + PUBLIC, an active organization, no deletion and no test flag. Content/category review warnings require organizer judgment.

Prices filter and sort by the lowest nonhidden ticket price. Final availability, sale windows, quantity limits and checkout price are checked by the existing ticket/payment services.

WhatsApp public sharing works; automated customer delivery still requires the production Meta sender and approved templates deferred earlier. No new automated customer messages were sent during verification.

## Verification

- `pnpm lint`, `pnpm test`, `pnpm typecheck`, `pnpm build`.
- Focused database tests cover individual/combined filters, SQL parameterization, pagination, visibility/test exclusion, direct test checkout prevention, saved-event uniqueness/ownership and wallet status classification.
- Unit tests cover filter ranges and URL state, calendar escaping/Unicode line folding, advisory quality warnings and authentication failure versus database failure.
- `AUTH_SMOKE_URL=http://localhost:3002 AWS_REQUEST_CHECKSUM_CALCULATION=WHEN_REQUIRED pnpm exec tsx scripts/verify-experience.ts` checks organizer creation/media, publishing, save/unsave, URL refresh/back, free booking, calendar, private ticket access, PDF, email payload, valid/duplicate QR check-in and cancellation. Disposable local data is removed afterward.
- `CAPTURE_URL=... CAPTURE_LABEL=before|after pnpm exec tsx scripts/capture-discovery-wallet.ts` records desktop/mobile screenshots. Artifacts are in `artifacts/discovery-wallet/`; populated wallet/detail shots come from the local authenticated browser workflow. Screenshots are ignored by Git.

No live card charge/refund, physical camera scan, screen-reader session or production guest recovery was performed. Paid flow correctness is exercised with the existing injected payment provider tests.

## Deployment and rollback

Apply migration `20261015040000_discovery_wallet` before starting the new web/worker images. It adds only `Event.isTest` and `SavedEvent`; existing events default to non-test. Keep the pre-release PostgreSQL dump and old container image. On failed health/auth/payment checks, restore the prior web/worker image; the additive migration is compatible with the prior code and should normally remain in place. Never restore the database dump over newer customer bookings without a separate recovery plan.
