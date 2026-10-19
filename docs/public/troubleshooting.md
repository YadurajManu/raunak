# Troubleshooting

Start with the specific stage that failed: sign-in, discovery, checkout, ticket preparation, delivery or admission. An empty view and a failed request are different states; read the displayed error and relevant local logs before creating more records.

## Documentation loads but the application does not

The documentation is designed to render independently of Firebase, database and provider credentials. Loading `/docs` does not prove the application's services are configured.

Check that `.env` exists, local Compose services are running, migrations are applied, and `pnpm dev` is using the expected environment. `/api/health` only confirms that its web route responds.

## Sign-in or session problems

Confirm the public Firebase web settings and server service-account settings belong to the same project. Enable the selected sign-in provider and authorize the local hostname. Keep the private key quoted with `\n` line breaks in the environment value.

`APP_URL` must match the browser origin, including port. A custom development port requires updating both the app URL and how you open the site. Expired/invalid sessions return the user to sign-in. Remember me controls cookie persistence; browser settings can still clear local cookies.

## An event is missing from Discover

Clear active city/date/category/price filters first. Public discovery requires a published public event, a future start, an active workspace, and no test or deleted marker. Draft, pending-review, rejected, suspended, cancelled and unlisted events do not enter the public list.

Saving a draft or submitting it for review does not publish it. Open the organizer workspace to check the actual status and any review note. Ended public event pages can remain available for attendee feedback while being excluded from upcoming discovery.

## Tickets are not on sale

Check the event publication state and date, ticket sale start/end, hidden flag, minimum/maximum quantity and remaining inventory. Stock can exist while the sale window is closed. A zero ticket price means Free; it does not mean a paid price was successfully saved.

## Cashfree request failed

Verify matching sandbox/production credentials, the expected API version, a valid buyer mobile number, app origin and permitted domain. Review the server error and Cashfree account response in a private operator environment without logging secrets.

Do not mark a booking paid because the user returned from checkout. Signed payment callbacks or verified provider lookup drive confirmation. A pending payment may still complete; avoid asking the buyer to charge again until the state is understood.

## Upload or processing is stuck

Inspect local S3 availability/CORS, upload validation and the running worker. Upload completion and image transformation are separate stages. Check processing errors rather than repeatedly uploading the same original. The original file is private; processed variants are what public pages use.

## Booking confirmed, PDF or email missing

Check the account used at checkout, then the booking/ticket preparation status. Ensure `pnpm worker` is running with database, Redis, signing secret and storage access. PDF failure and provider delivery failure need different fixes.

For SMTP development, inspect Mailpit at `http://localhost:8025`. For Resend, confirm the sender is verified and the key is valid. Use permitted resend/retry actions after resolving the underlying error; repeated manual sends can duplicate delivery.

## WhatsApp did not arrive

Confirm the attendee opted in, the phone is usable, the workspace selected a connected route and the event's message is enabled. Official Meta delivery needs the correct approved template and sender. A linked gateway additionally needs a valid session, private service access and an explicit enable flag.

Inspect delivery state and suppression/error codes. STOP suppression, caps, quiet hours, disconnects or unavailable templates can prevent a send. Do not bypass consent or delete duplicate-protection state to force another message. Check email or the authenticated wallet for the ticket.

## Camera or entry problems

Grant camera permission in a secure browser context, check the selected camera and lighting, and try the manual lookup fallback. A valid-looking QR image can still be refused if its booking/event is invalid or it was already admitted.

Check the selected event and displayed reason. Use the event manager for ambiguous matches. The current scanner needs the server/network; there is no offline admission sync.

## Report a reproducible issue

Record the route, commit, browser/device, expected result, actual result and minimal steps. Redact personal data, admission links, account details and credentials. For vulnerabilities, use the [private security reporting process](contributing.md#report-security-issues).
