# WhatsApp webhook

Callback URL: `https://raunak.yaduraj.me/api/webhooks/whatsapp`

The server's `WHATSAPP_WEBHOOK_VERIFY_TOKEN` must match Meta's **Verify token**.
The separate `WHATSAPP_APP_SECRET` comes from Meta App settings → Basic and
verifies signed POST bodies. Neither value belongs in client code or Git.

## Meta setup

1. Enter the callback URL and server verify token, then **Verify and save**.
2. Subscribe to the `messages` webhook field and send a dashboard test event.
3. Register/verify the business phone number and complete Meta's requirements
   for production delivery. An unpublished app may only receive dashboard tests.

Leave the client-certificate option disabled; this integration authenticates
webhooks using Meta's `X-Hub-Signature-256` signature.

## Implemented

- Constant-time token/signature comparisons and verification of the raw bytes.
- Bounded payload reads and schema validation before database writes.
- Private, durable `WebhookEvent` receipts for incoming messages and changes.
- Per-message/status idempotency; retries do not duplicate receipts.
- Atomic notification status updates; late sent/failed/delivered events cannot
  downgrade a read notification. Unknown signed changes are archived safely.
- HTTP 503 on database failure so Meta can retry instead of losing the receipt.

This endpoint does not automatically reply to incoming messages. Outbound ticket
notifications still require the Meta access token, Phone Number ID, WABA ID,
approved templates, and the ticket/notification workflow. Do not send customer
messages until those are connected and the sender has been verified.

Receipts can contain message text and phone numbers. They are not exposed by a
public API or written to request logs. Apply a retention policy before production
customer messaging.
