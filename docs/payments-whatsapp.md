# Payments and ticket delivery

## Cashfree

Production credentials are server environment variables only. They must never be
committed or exposed through NEXT_PUBLIC variables. Checkout creates a Cashfree
order on the server and supplies its payment session to Cashfree hosted checkout.
The order includes its return URL and the Raunak notify URL automatically.

Cashfree dashboard → Payment Gateway → Webhooks → Add Webhook Endpoint:

`https://raunak.yaduraj.me/api/webhooks/cashfree`

Select successful payments, failed payments and user-dropped payment events.
The existing webhook for another application must remain unchanged.

Webhook signatures are checked against the original bounded request body. Only
verified SUCCESS events issue tickets. Failed attempts leave the checkout session
and inventory hold open so the buyer can retry; unused holds expire automatically.
Duplicate success events do not issue duplicate tickets. Signed notifications for
other applications sharing this merchant account are acknowledged and ignored.

`scripts/verify-payments.ts` checks live credentials and the deployed webhook
without creating orders or charging anyone. A real paid checkout and settlement
still require a manual buyer test in Cashfree production.

## WhatsApp — activation deferred

The supplied Meta test sender is authenticated, but Meta rejected creation of
Raunak templates because this test WABA is restricted. Its sample grocery-store
templates are not used for customer payment confirmations. WhatsApp checkout
opt-in is shown only when a Raunak template and sender are configured for an
enabled event message. Tickets remain available in the attendee wallet.

Production activation needs a business sender, a durable access token and approved
utility templates mapped through WHATSAPP_TEMPLATE_MAP. Event organizers can turn
ORDER_CONFIRMED and TICKET_ISSUED messages on or off in the event Messages page.
Buyer WhatsApp consent is required. Other reminders need their own approved maps.

An approved ticket template can use `documentHeader: true`. The worker uploads the
generated QR ticket PDF directly to Meta and sends its media ID in the template
header, without publishing the private storage object. Body variables must match
the approved template exactly. For example:

```json
{
  "TICKET_ISSUED": {
    "name": "raunak_ticket_pdf_v1",
    "language": "en_US",
    "variables": ["attendee_name", "event_title", "ticket_url"],
    "documentHeader": true
  }
}
```

This is an example configuration, not an approved template. Delivery logs retain
provider failures and permit authorized retries. Template previews do not generate
valid entry tickets. Email delivery also requires configured email credentials.
