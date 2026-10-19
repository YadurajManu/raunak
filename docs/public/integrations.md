# Configure integrations

Raunak includes provider implementations and local substitutes for development. Credentials and provider approval are separate from code being present. Keep all server credentials in the ignored environment, never browser bundles.

## Firebase authentication

Configure the web app's public Firebase settings and matching server service-account settings. Enable the sign-in providers you intend to use and authorize your app domain. The server exchanges a recent verified Firebase token for an HTTP-only session cookie.

Remember me persists the session cookie for fourteen days; browser-session mode omits its persistent maximum age. Initial sign-up does not require email verification in the implemented flow. Authenticated features still require a valid Firebase-backed account.

Platform reviewers are selected by Firebase UID through `RAUNAK_ADMIN_FIREBASE_UIDS`. There is no public admin registration path. A workspace role cannot grant platform reviewer access.

## Cashfree payments

Use `CASHFREE_ENV=sandbox` during development, with the matching `CASHFREE_APP_ID`, `CASHFREE_SECRET_KEY` and `CASHFREE_API_VERSION`. The repository example pins the API version string; preserve a tested version when deploying.

Paid checkout creates hosted sessions. Success, failure and user-dropped payment webhooks use `/api/webhooks/cashfree`; raw-body signature verification runs before applying payment state. Configure the website domain and webhook in the correct Cashfree account/environment.

Free bookings do not need Cashfree. Automated tests inject a payment provider for local scenarios; these checks do not establish live charges, refunds or bank settlement. The repository does not supply organizer bank onboarding or Easy Split distribution.

## S3-compatible storage

Set the `S3_*` endpoint, region, bucket, credentials and public base URL. Local development uses LocalStack at port 9000 with a bucket created by Compose initialization. Production can use a compatible object store with correct CORS, private-object policies and backups.

Original media, PDFs and credentials must remain private. Processed public artwork is served through the application's permitted media path. Keep the worker running to produce image variants and ticket PDFs.

## Email: SMTP or Resend

Choose `EMAIL_PROVIDER=smtp` with `SMTP_HOST`, `SMTP_PORT` and `EMAIL_FROM`. The root development services use Mailpit; inspect messages at `http://localhost:8025` without sending to an external inbox.

For Resend, select `EMAIL_PROVIDER=resend`, supply `RESEND_API_KEY`, and use `EMAIL_FROM` on a verified sender/domain. Production SMTP may require `SMTP_USER` and `SMTP_PASSWORD`. Tickets, booking confirmations and other notifications use the configured provider and database delivery log.

> [!NOTE]
> A sent status records provider acceptance; it does not prove inbox placement or that a ticket was read. Check worker errors and provider logs before resending.

## Official Meta WhatsApp

The official implementation uses Meta Cloud API credentials, a sender Phone Number ID, WABA ID, webhook verification settings and `WHATSAPP_TEMPLATE_MAP`. Production outbound templates must be approved and match their configured variables/document headers. Temporary test tokens and test senders are insufficient evidence of customer-wide production delivery.

Attendee consent, a usable phone number, enabled message settings and the workspace's selected delivery route determine eligibility. Configure status callbacks and verify actual device receipt separately.

## Optional linked WhatsApp gateway

The Baileys gateway is an optional private, long-lived service. It needs its own internal API key, encryption key, Redis/database access, explicit enable flag and a deliberately linked number. It is disabled by default and unsuitable for a short-lived serverless function.

Workspace Owners/Admins can link their organization's number and choose delivery mode when the service is configured. Official Meta and linked-number modes remain distinct; selecting one does not silently validate the other.

The gateway implements serialized sending, consent checks, rate caps, duplicate handling, suppression and session recovery logic. These controls do not guarantee WhatsApp account safety or delivery. The existing runbook's real-phone acceptance checklist remains pending unless an operator records fresh device evidence.

> [!WARNING]
> Baileys is an unofficial connection. WhatsApp may disconnect or restrict the linked number, and upstream changes can break it. Keep email independent and complete spare-number acceptance before relying on it at an event.

## Maps and geocoding

MapLibre renders venue maps. `GEOAPIFY_API_KEY` enables server-side address/city lookup and reverse geocoding. Map tiles use the configured public tile URL and attribution. Manual location entry remains useful if location permission or an external lookup fails.

## Verification boundary

Local tests and source review can verify parsing, authorization, state transitions and mocked provider calls. Live Cashfree charge/refund/settlement, verified email sender delivery, approved Meta templates and physical-phone gateway/camera behavior require their own configured environment and observed acceptance. Documentation changes do not perform those operations.
