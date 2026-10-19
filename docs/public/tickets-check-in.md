# Tickets and check-in

A confirmed booking creates individual admission tickets. The wallet, PDF and delivered ticket card carry the same signed admission identity; the server decides whether it is still valid at entry.

## One QR per admission

The ticket service signs a versioned token with the ticket ID and event ID using a server-only HMAC secret. Admission links use `/t/<signed-token>`. A ticket code helps manual lookup, but a reference number by itself is not a public recovery credential.

Tickets have Valid, Used, Cancelled or Refunded status. Orders also have their own payment/refund state. A public event link is safe to share; a reusable admission link should be treated as private.

## Ticket preparation and delivery

Once the booking is confirmed, the worker prepares its PDFs in private storage and queues applicable notifications. Ticket-issued emails can include the PDF and QR image. Linked-gateway WhatsApp messages can include a styled card and optional PDF according to saved attachment settings. The official Meta provider uses approved templates and supported document headers.

The wallet can show the confirmed ticket while the PDF/delivery is still being prepared. Delivery logs and error states help distinguish preparation, queued delivery and provider failures. Resend actions are restricted to eligible owners and allowed channels.

## Prepare the entrance team

1. Assign the appropriate workspace/event access to every staff account.
2. Open the correct event's Check-in page.
3. Check camera permission, lighting and network access on the actual entrance phone.
4. Confirm manual lookup works before the first guest arrives.
5. Test with a disposable local or sandbox ticket rather than a customer's admission.

The scanner offers camera guidance and manual entry when camera access is denied, unavailable or unsuitable. Browser camera access needs a secure context, normally HTTPS outside localhost.

## Scan or look up a guest

The check-in service accepts either a signed scan token or an authorized manual ticket selection. It verifies staff permission, the event, the ticket and the booking on the server before updating admission.

| Result | Staff action |
| --- | --- |
| Valid | Admit one guest. The ticket becomes Used with a timestamp and staff identity. |
| Already used | Do not admit again; inspect the previous entry information and contact the event manager. |
| Invalid | Check the event and ticket details; follow the displayed reason before admitting anyone. |

The update is conditional and transactional, so simultaneous scans cannot both claim the same valid admission. Check-in actions are audit logged. Cancelled, suspended, ended, test or deleted events cannot be used for admission through this flow.

## Manual lookup

Search can match holder name, email, phone, ticket code or an order UUID. It is bounded and available only after staff authorization for the event. Select the correct guest and confirm entry; the same admission validation applies as for a QR scan.

Manual lookup is an operational fallback, not a way to bypass payment or ownership. Staff should resolve ambiguous matches with the event manager rather than guessing from a common name.

## Understand the current limits

Check-in requires a working network and server. The repository does not implement offline admission synchronization or hardware scanner certification. Automated tests cover permissions, invalidation and competing scans; actual camera/device acceptance must be performed at the venue.

Keep the ticket-signing secret stable across an active event. Rotating it invalidates existing signed links unless a deliberate compatibility plan is introduced. Back up the database and signing/encryption settings securely.
