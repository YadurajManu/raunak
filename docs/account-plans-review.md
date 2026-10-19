# My plans: attendee dashboard review

Route: `/account`. The attendee hub is now called **My plans**. The organizer workspace remains at `/dashboard` and is labelled **Organizer dashboard** only for active organization members.

## Problems found and changes made

| Problem | Implemented change |
| --- | --- |
| Attendee and organizer navigation used confusing dashboard labels | Shared navbar/profile labels distinguish My plans from Organizer dashboard; member-only hosting links use active membership checks. |
| Large greeting with little useful information | Compact editorial greeting with real upcoming-ticket and saved-event counts. |
| USED tickets appeared under Coming up | Shared wallet query now classifies USED as Past, even if the event date is in the future. Cancellation/refund precedence and owner checks are preserved. |
| Repeated admission cards for the same booking | Ticket stubs group admissions by booking and show ticket types, quantities, date/time/timezone, venue, organizer, reference and ticket actions. A bounded preview links to all tickets. |
| Ticket cards did not provide entry access | Show ticket opens the existing protected ticket detail. Active QR codes have a keyboard-accessible full-screen dialog, including focus restoration and a brightness suggestion. |
| Partial refunds promised unavailable admission QR | Partial-refund stubs display the refund status and link to the protected booking instead of promising an entry QR. Backend admission policy is unchanged. |
| Exact locality matching produced misleading nearby emptiness | Consented location resolves to a supported city hub, with a 50 km radius using the same server discovery function as Discover. Users can change the city or select all cities; this browsing choice is remembered locally. |
| Nearby empty state offered little help | Honest all-city upcoming-event fallback, weekend/free/online browsing links, and a hosting action when no public events exist. No popularity or intelligent-personalization claim. |
| Saved events were missing | Real saved-event preview with persistent save/unsave actions; compact rows on the overview and a dedicated Saved tab. |
| Orders lacked hierarchy and useful details | Aligned rows with event, ticket quantities/types, booking date/reference, amount and status; pending orders offer Check payment. Orders have stable pagination and bounded queries. Whole-rupee amounts omit decimals; zero is Free. |
| Account actions were hard to find | Upcoming, Past, Saved, Orders and Settings navigation. Profile/phone editing, booking recovery, delivery guidance and support reuse existing routes. |
| Hosting was invisible | Active organization members see a Hosting snapshot linking directly to their workspace events. |
| Loading or retrieval failure could be mistaken for no bookings | Account loading skeleton and error boundary with retry, My tickets and support actions. |
| Mobile text/actions clipped or shrank | Responsive ticket/order layouts, wrapping saved-event organizer names, visible focus, light/dark tokens and 44px primary action targets. |

## Working actions reused

- Authenticated ticket and booking details enforce buyer ownership server-side.
- Existing calendar endpoint, public event sharing, venue directions, ticket PDF/resend links and multi-ticket navigation remain available.
- Existing profile and contact settings are reused. No unsupported notification toggle is shown.
- Public discovery continues to exclude drafts, cancelled, deleted, private and test events using existing visibility predicates.

## Verification

Testing used a disposable local database and temporary test accounts. No production bookings, payments, messages or data were changed.

- TypeScript check and lint of changed application files passed.
- Unit suite: 38 files, 92 tests passed.
- Discovery/wallet database integration: 3 tests passed, including owner isolation, USED classification, cancellation/refund precedence and public discovery filters.
- Browser checks: all five tabs; save persistence; remembered city after refresh; grouped admissions; pending/free orders; cancelled/refunded notices; today's-event highlight; partial-refund routing; order pagination and browser history; retrieval failure and successful retry.
- Security/browser checks: signed-out redirect; another account sees ticket/booking not-found screens without private ticket content; inactive tickets do not render the new QR dialog.
- Full-screen QR: mobile fit, Escape, native modal focus behavior and focus return passed.
- Before/after captures: 375, 768 and 1440 widths in light/dark, at default browser scaling. No page horizontal overflow.
- Production build passed, including framework TypeScript and route generation. Independent design review passed after correcting saved-name wrapping, partial-refund actions and mobile touch targets.

Screenshots are in `artifacts/account-review/`, which is ignored by Git. `artifacts/account-review/index.html` compares the six pairs. These captures deliberately include missing-poster fallback states.

## Backend dependencies and policy issues

1. **Check-in window:** the check-in service validates event/payment/ticket eligibility but does not restrict admission to doors opening through event end. This is a confirmed backend policy gap. It was reported, not silently changed by this UI release. Define early-entry allowance and multi-day/re-entry behavior before implementing a server-side window.
2. **Partial refunds:** wallet queries can include partially refunded bookings, but entry detail and check-in currently require PAID. The dashboard now routes these bookings to their status page. A consistent remaining-admission policy requires a separate backend change.
3. **Signed ticket lifecycle:** `/t/[token]` is a bearer ticket route and does not enforce all the same event-expiry/publication rules as authenticated details. Keep ticket links private and audit lifecycle parity separately.
4. **Notification preferences:** WhatsApp consent is recorded per order at checkout. There is no account-level email/WhatsApp preference endpoint. New account toggles need defined semantics, consent storage and delivery enforcement.
5. **Receipts/invoices:** the system supports booking/payment details and email receipts, but no standalone invoice or receipt download endpoint.
6. **Offline entry:** no offline ticket cache or wallet pass exists. The QR dialog requires the protected page to load. Browsers cannot generally increase device brightness; the UI suggests adjusting it manually.
7. **Later capabilities:** notify-me subscriptions, ticket transfers, Apple/Google Wallet passes and popularity ranking need real backend support. Guest checkout is not currently supported; booking recovery uses the authenticated account rather than booking-reference-only access.

## Limits of this verification

No live payment, email/WhatsApp send, production deployment, offline admission or real photographic-crop evaluation was performed for this UI pass. Existing unrelated workspace changes were preserved.
