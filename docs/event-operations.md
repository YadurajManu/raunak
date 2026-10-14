# Event operations

The event overview shows captured payments, successful refunds, net collected, active ticket inventory and recorded arrivals. Net collected is before gateway charges and organizer settlements; it is not an organizer payout calculation. Bookings have search, status filters and pagination. Attendees have search, status filters, pagination and streamed CSV export with spreadsheet formula protection.

## Access

- Owners/admins: manage events, attendee delivery and full booking refunds.
- Assigned managers: manage events and resend tickets; no refund authority.
- Finance members: view the overview/attendees, export and refund; no event editing.
- Assigned check-in staff: attendee lookup and entry checks; no export, delivery or refund actions.

## Cancellation and refund flow

Event cancellation stops sales/entry and queues event cancellation notices through the existing worker. Refunds are reviewed per booking rather than automatically issued for the whole event.

Cancelling a booking revokes its tickets immediately and restores its active inventory once. Paid bookings create one full refund using the verified payment amount and a stable refund ID; free bookings do not call Cashfree. Cashfree refunds beyond its six-month window are rejected before revoking entry. Row locks and provider idempotency protect concurrent requests. Completed refunds cannot regress to pending/failed from stale responses. Refund success changes the order and cancelled tickets to refunded. Failed requests remain visible and recoverable through the worker or Check refund.

Cancellation/refund emails use the existing durable WebhookEvent outbox and Resend idempotency. Stale refund notifications are skipped. Customer booking pages display provider status and references remain visible to organizers.

## Release

Migration `20261015023000_notification_resends` removes two obsolete partial unique indexes that blocked explicit receipt/ticket resends. The unique dedupeKey index remains authoritative; no message or customer data is removed. Back up the database before applying the migration.

Tests cover permissions, concurrency, expired windows, free cancellations, provider failure recovery, resend revisions and safe CSV. Browser verification covers booking, delivery payloads, entry, organizer views, export, resend and cancellation on desktop/mobile. Paid refunds use the mock provider during tests; no live refund is issued by verification.
