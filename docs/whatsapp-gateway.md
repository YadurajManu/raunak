# WhatsApp gateway implementation

The requested Baileys extension is under active implementation. Completion is tracked below; production activation and real-phone acceptance must not be inferred from checked code milestones.

- [x] W0: schema, shared contracts, environment, workspace foundations (local migration and typecheck verified).
- [x] W1: internal HTTP service, mock engine, locks, serialization and deduplication (private HTTP provider integration verified).
- [x] W2 code: real Baileys engine, encrypted PostgreSQL state, lifecycle and addressing (state restore and disconnect mapping tested; phone reconnect/logout acceptance pending).
- [x] W3 code: authorized linking UI, QR/pairing and usage (API authorization tested; real-phone linking acceptance pending).
- [x] W4: consent/suppression/caps/quiet-hours policy, provider routing and retries (policy and routing integration tests pass).
- [x] W5: signed ticket-card images, PDF and multi-ticket delivery (two real test cards decoded and accepted by check-in; email delivery tested independently).
- [ ] W6: opt-in timestamps, inbound STOP/TICKET and receipts.
- [ ] W7: full-body template editing, attachment controls, modes and retry UI.
- [ ] W8: alerts, container/runbook, mock load tests and acceptance checks.

## Verified upstream references

- [Baileys repository](https://github.com/WhiskeySockets/Baileys).
- [v7 migration](https://baileys.wiki/migration/v7).
- [Session management](https://baileys.wiki/authentication/session-management).
- [Pairing codes](https://baileys.wiki/authentication/pairing-code).
- [Sending messages](https://baileys.wiki/messaging/sending-messages).

Pinned engine: `baileys@7.0.0-rc14` (ESM). The registry's latest is a release candidate; it is pinned rather than floating. The v7 adapter must persist all Signal key categories including LID mappings, device lists and tokens. Incoming LIDs are not phone numbers; use alternative PN addresses or a known mapping, and never guess a phone number from a LID. The adapter must use BufferJSON and persist key changes before resolving. Pairing waits for socket readiness. No filesystem auth store is used.

The gateway must start as ESM (`pnpm --filter @raunak/wa-gateway start`), because v7 and its Rust bridge do not support the CommonJS import path. `ENCRYPTION_KEY` must be a 32-byte key encoded as 64 hex characters or base64. Keep the key backed up separately from the database. A key change without decrypting and re-encrypting existing rows requires re-linking; rotate under a maintenance window with sockets stopped.

## Deployment boundary

The gateway is a single long-lived process and cannot run on serverless. Next.js and the worker talk to it over a private authenticated HTTP endpoint. `WA_UNOFFICIAL_ENABLED=false` is the default. Email remains independent. Production sessions must be linked deliberately; tests use the mock engine and never connect real WhatsApp sockets.

The schema defaults new organizations to DISABLED. Application onboarding can select PLATFORM_NUMBER only if a platform session is connected. Existing OFFICIAL_API operation is selected explicitly per organization once modes are wired.

## Policy defaults

Transactional triggers only; consent and suppression checked before sending. Per session: 8 messages/minute; warm-up 30/day on days 1–2, 60 on 3–4, 120 on 5–7, 250 on 8–14, then 400/day. Recipient limit: 6/day. Normal inter-message delay 4–12 seconds. Reminders are deferred from 22:00 to 07:00 in the event timezone. These are conservative traffic controls, not protection against restrictions or a guarantee of delivery.

Daily counters reset at 00:00 UTC, minute counters at the next UTC minute; quiet hours use the event timezone and handle DST. Caps reserve sends atomically before attempting delivery, including failed attempts. Cap/quiet-hour deferrals do not consume the worker's failure-attempt allowance. Three consecutive engine failures pause a session for 15 minutes; it stays paused until an administrator requests Connect and its number passes a health lookup. Ban-like and replacement disconnects require deliberate re-linking.

For an immediate runtime stop, set Redis key `wa:kill-switch` to `1`; remove it to lift that runtime stop. `WA_UNOFFICIAL_ENABLED=false` always blocks sends, but changing a process environment value requires restarting the affected app/worker/gateway processes (no code deployment required). The kill switch never blocks email or the explicitly selected official API.

## Real-phone acceptance pending

Gateway retries return the original cached result for 24 hours. A send that crashes after network acceptance but before recording its result remains ambiguous and is not automatically resent. This avoids blind duplicates; email is the backup and an operator must investigate. Exactly-once delivery cannot be guaranteed across a network and process crash. The private gateway must not be exposed through the public application tunnel.

Ticket cards use Sharp PNG composition, a 470-pixel black/white QR with a four-module quiet zone, and the existing signed per-ticket URL. QR decoding is tested at full resolution and at 390-pixel card width. No ticket cards are published in public storage. Above ten tickets, the first WhatsApp ticket job links to the existing authenticated `/orders/[id]` page and the remaining jobs are marked grouped/skipped; this project has no signed order `/t/[token]` route. Email still delivers individual tickets.

Link a dedicated spare number, make a two-ticket sandbox booking, scan both delivered QR cards, edit the template and retest, restart the gateway, unlink from the phone, test STOP/TICKET, exercise the kill switch and retry a message. Record the actual results; mock assertions do not substitute for these checks.
