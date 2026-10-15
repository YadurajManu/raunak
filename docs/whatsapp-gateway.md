# WhatsApp gateway implementation

The Baileys extension is implemented behind an explicit enable flag. Code and automated verification are tracked below; production activation and real-phone acceptance must not be inferred from checked code milestones.

- [x] W0: schema, shared contracts, environment, workspace foundations (local migration and typecheck verified).
- [x] W1: internal HTTP service, mock engine, locks, serialization and deduplication (private HTTP provider integration verified).
- [x] W2 code: real Baileys engine, encrypted PostgreSQL state, lifecycle and addressing (state restore and disconnect mapping tested; phone reconnect/logout acceptance pending).
- [x] W3 code: authorized linking UI, QR/pairing and usage (API authorization tested; real-phone linking acceptance pending).
- [x] W4: consent/suppression/caps/quiet-hours policy, provider routing and retries (policy and routing integration tests pass).
- [x] W5: signed ticket-card images, PDF and multi-ticket delivery (two real test cards decoded and accepted by check-in; email delivery tested independently).
- [x] W6: opt-in timestamps, inbound STOP/TICKET and monotonic receipts (STOP blocks a later worker job, duplicate STOP sends one acknowledgement).
- [x] W7: full-body template editing, attachment controls, workspace/event defaults, modes and retry UI (saved edits change the next actual mock delivery).
- [x] W8: alerts, container/runbook and mock load checks implemented. Real-phone pairing and delivery acceptance remain pending. The last local run passed 120/121 tests; one full-card QR detector check failed intermittently. Additional testing was stopped at the user's request before deployment.

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

The schema defaults organizations to DISABLED. Application onboarding selects PLATFORM_NUMBER only if the platform session is connected. Existing organizations must deliberately choose OFFICIAL_API or a linked-number mode in settings; migration never silently activates a new sending engine. Preserve existing official sender credentials/template mappings when upgrading.

## Policy defaults

Transactional triggers only; consent and suppression checked before sending. Per session: 8 messages/minute; warm-up 30/day on days 1–2, 60 on 3–4, 120 on 5–7, 250 on 8–14, then 400/day. Recipient limit: 6/day. Normal inter-message delay 4–12 seconds. Reminders are deferred from 22:00 to 07:00 in the event timezone. These are conservative traffic controls, not protection against restrictions or a guarantee of delivery.

Daily counters reset at 00:00 UTC, minute counters at the next UTC minute; quiet hours use the event timezone and handle DST. Caps reserve sends atomically before attempting delivery, including failed attempts. Cap/quiet-hour deferrals do not consume the worker's failure-attempt allowance. Three consecutive engine failures pause a session for 15 minutes; it stays paused until an administrator requests Connect and its number passes a health lookup. Ban-like and replacement disconnects require deliberate re-linking.

For an immediate runtime stop, set Redis key `wa:kill-switch` to `1`; remove it to lift that runtime stop. `WA_UNOFFICIAL_ENABLED=false` always blocks sends, but changing a process environment value requires restarting the affected app/worker/gateway processes (no code deployment required). The kill switch never blocks email or the explicitly selected official API.

## Real-phone acceptance pending

Gateway retries return the original cached result for 24 hours. A send that crashes after network acceptance but before recording its result remains ambiguous and is not automatically resent. This avoids blind duplicates; email is the backup and an operator must investigate. Exactly-once delivery cannot be guaranteed across a network and process crash. The private gateway must not be exposed through the public application tunnel.

Ticket cards use Sharp PNG composition, an integer-pixel QR up to 520 pixels with high error correction and a four-module quiet zone, and the existing signed per-ticket URL. QR decoding is tested across different signed payloads at full resolution and at 390-pixel card width. No ticket cards are published in public storage. Above ten tickets, the first WhatsApp ticket job links to the existing authenticated `/orders/[id]` page and the remaining jobs are marked grouped/skipped; this project has no signed order `/t/[token]` route. Email still delivers individual tickets.

Inbound commands are accepted only from new direct messages with an actual PN address or a known v7 LID-to-PN mapping. STOP suppression and the deduplicated inbound outbox are one database transaction; replies survive restarts and cap deferrals. Reply recipients are encrypted in the outbox. Unknown text is recorded only as OTHER, with no message body or raw phone. The sole suppression exception is the one requested STOP acknowledgement; TICKET respects suppression. Platform STOP applies globally, organization STOP applies to that organization.

Link a dedicated spare number, make a two-ticket sandbox booking, scan both delivered QR cards, edit the template and retest, restart the gateway, unlink from the phone, test STOP/TICKET, exercise the kill switch and retry a message. Record the actual results; mock assertions do not substitute for these checks.

## Local run

1. Install with `pnpm install --frozen-lockfile`, start local dependencies with `docker compose up -d`, then run `pnpm db:migrate` and `pnpm exec prisma generate`.
2. In the ignored root `.env`, configure the database, Redis, existing ticket-signing secret and email provider. Generate independent random secrets for `WA_GATEWAY_API_KEY` (at least 32 characters) and `ENCRYPTION_KEY` (32 random bytes encoded as hex/base64). Do not overwrite a key already encrypting sessions.
3. Set `WHATSAPP_PROVIDER=baileys`, `WA_GATEWAY_ENGINE=baileys`, `WA_GATEWAY_URL=http://127.0.0.1:3101`, `WA_UNOFFICIAL_ENABLED=true`, and `WA_ADMIN_EMAIL` for platform alerts. No Meta credentials are needed for linked-number mode.
4. Start three terminals: `pnpm dev`, `pnpm worker`, and `pnpm --filter @raunak/wa-gateway start`. The gateway reads the root `.env`; it binds to loopback by default.
5. For CI/local simulations use `WA_GATEWAY_ENGINE=mock` and `WHATSAPP_PROVIDER=mock`. The mock only connects when a test explicitly emits a connection event; it never opens WhatsApp sockets. Do not select mock on production traffic.

### Link an organization number

1. Sign in as an active workspace Owner/Admin. Open **Workspaces → WhatsApp integration** and choose the workspace.
2. Select **My own number**, then **Connect number**. Scan the live QR using WhatsApp → Settings → Linked devices → Link a device.
3. On one phone, choose **Link with phone number instead**, enter the full number, get the code, and enter it under WhatsApp’s phone-number linking option. Pairing is available only while the unregistered socket is ready.
4. Wait for Connected; the QR disappears. Confirm the masked number, warm-up limit and delivery mode.
5. Send a test to a number you own/have permission to contact. The optional sample card is explicitly not valid for entry. Then customize workspace defaults or an event’s Messages tab and run the real two-ticket acceptance check.

### Platform number (trusted server operator only)

Organization-facing routes cannot inspect or manage the platform session. A trusted operator with database/private-gateway credentials can run:

```sh
pnpm exec tsx scripts/whatsapp-platform.ts connect
pnpm exec tsx scripts/whatsapp-platform.ts pairing +91XXXXXXXXXX
pnpm exec tsx scripts/whatsapp-platform.ts status
pnpm exec tsx scripts/whatsapp-platform.ts disconnect
```

Connect writes a mode-600 QR PNG in a private temporary directory, refreshes it for up to one minute, and deletes it afterward; open that file locally while the command runs. It never prints raw QR strings or auth keys. Pairing intentionally displays a private one-time code in the operator’s terminal. Run these commands in a private terminal, not a recorded CI job. The gateway’s authenticated internal create endpoint permits the platform row; public organization APIs never accept a null organization.

## Production container

The root Dockerfile has a `wa-gateway` target; it shares pinned workspace dependencies and the generated Prisma client, includes Noto fonts for card rendering, and avoids a Next.js build for the gateway target. `deploy/compose.yml` runs it only with profile `whatsapp`, on the private default network, with no published port and no fleet/tunnel network. Keep one gateway instance. Redis ownership locks contain accidental duplicates; they do not make simultaneous multi-device sessions supported.

Back up PostgreSQL and the encryption key separately, preserve the prior application image, and set the server environment deliberately. Build/migrate before restarting:

```sh
docker compose --env-file .env -f deploy/compose.yml --profile whatsapp build web wa-gateway
docker compose --env-file .env -f deploy/compose.yml run --rm web pnpm db:migrate
docker compose --env-file .env -f deploy/compose.yml --profile whatsapp up -d web worker wa-gateway
docker compose --env-file .env -f deploy/compose.yml --profile whatsapp ps
```

The authenticated `/healthz` checks Redis and PostgreSQL. Docker’s health check supplies the key from the environment without printing it. Structured gateway logs contain event names/error codes, never QR strings, auth keys or message bodies. Keep `.env`, backups and logs private. Restart reconnects only sessions with active lifecycle states; logged-out, paused and ban-like sessions require deliberate review/re-linking. Connection alerts have a durable outbox and per-recipient idempotency keys; SMTP can still duplicate an email across an ambiguous network failure.

### Incident and rollback

- Immediate stop: using an authenticated private Redis client, `SET wa:kill-switch 1`. Sends check it again just before network delivery. Email and explicit official API mode continue. `DEL wa:kill-switch` removes that runtime stop, but cannot override `WA_UNOFFICIAL_ENABLED=false`.
- Disconnect/replacement/ban: review the status and owner/admin alert. Never run competing reconnect processes. Use Disconnect and re-link a dedicated number after resolving the cause. Circuit-breaker pause resumes only after a manual Connect request and a successful lookup.
- Partial/uncertain delivery: inspect `NotificationLog.errorCode`, provider IDs and `attachmentsSent`. Accepted attachment IDs are recorded incrementally. Do not delete dedupe keys or blindly resend. Email is independent and contains the tickets.
- Rollback: stop the gateway profile, disable unofficial sends, and restore the prior web/worker image. The migration is additive; do not remove session columns or restore an old database over later customer writes. Select OFFICIAL_API explicitly when returning an organization to its configured Meta sender.
- Rotation: stop all gateway sockets, decrypt/re-encrypt rows with the old/new 32-byte keys in a controlled maintenance operation, then restart with the new key. Without that operation, clear only the affected auth states and re-link. Never replace the key while live sockets can write.
- Retention: periodically delete processed inbound/alert outbox records older than your retention policy (for example 30 days). Keep suppressions until a documented, verified opt-in change permits removal. Redis QR/results/verification/cap records expire automatically; PostgreSQL auth persists until disconnect/logout or operator removal.

## Verification and manual acceptance

Automated gates: `pnpm db:migrate`, `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`, and `pnpm exec playwright test`. Gateway tests use mock sockets, actual local PostgreSQL/Redis and real signed ticket cards. The mock load test sends 200 messages with 20 concurrent callers through the serialized queue; caps, HTTP authentication, tenant isolation and idempotency are verified separately. Existing browser coverage does not include a full paid authenticated golden path; live payment/phone acceptance is listed below rather than claimed as passed.

Browser artifacts are generated under `artifacts/whatsapp/` (ignored by Git). The development-only preview route is unavailable in production.

- [ ] Link a spare dedicated number by QR within one minute; verify pairing on a single phone too.
- [ ] Complete a sandbox purchase of two tickets with WhatsApp consent; receive two cards and email within the expected window. Scan both QR codes with the actual phone camera. Enable PDF attachments and verify opening them.
- [ ] Edit the saved ticket message and make another booking; confirm the changed first-card caption and fallback links.
- [ ] Restart the gateway and reconnect without scanning again. Unlink from the phone; verify LOGGED_OUT, cleared auth, owner/admin email, and email-only delivery afterward.
- [ ] Reply STOP/band; receive one acknowledgement and verify later bookings skip WhatsApp. Test TICKET on an unsuppressed consenting number; verify only that number’s valid current tickets return.
- [ ] Retry a notification and confirm no duplicate. Exercise caps, reminder quiet hours, circuit pause/manual health probe and the runtime kill switch.
- [ ] Inspect mobile and desktop linking/settings/message previews in light and dark mode. Verify another organization’s owner cannot access the connection or ticket data.

These phone checks remain pending. Unofficial WhatsApp delivery can disconnect or be restricted despite the traffic controls.
