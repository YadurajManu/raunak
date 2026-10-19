# Event review console

Raunak's platform review console is served at `/admin` on the existing site. It uses the same application, database, and verified Firebase session as the rest of Raunak; no separate admin account or subdomain is created.

## Grant platform access

1. Sign in to Firebase Console and open **Authentication → Users**.
2. Copy the Firebase UID for each trusted platform reviewer.
3. Set the server-only environment variable `RAUNAK_ADMIN_FIREBASE_UIDS` to a comma-separated list of those UIDs, then restart or redeploy the app.
4. Each reviewer signs in through Raunak as usual and opens `/admin`.

The app checks the verified session and exact UID allowlist on the page and every admin API request. Organization owner/admin roles do not grant platform access. There is no public admin sign-up, and the UID variable must never use a `NEXT_PUBLIC_` prefix. If the allowlist is empty, all platform-admin access is denied.

## Review lifecycle

- Organizers submit a complete draft for review; the event stays private while `PENDING_REVIEW`.
- A reviewer can approve and publish, request changes, or reject with a reason. The note appears in the organizer workspace.
- Organizers can edit returned or rejected events and resubmit them.
- A reviewer can suspend a published listing with a reason or restore a suspended listing.
- Decisions and submissions are written to the organization audit log. Public discovery and checkout continue to require `PUBLISHED` status.

Run `pnpm db:migrate` before starting an application release that contains the moderation migration. Configure the reviewer UID allowlist in the production server environment before granting access.

Suspending an event removes it from public discovery and prevents new checkouts and check-ins. It does not automatically cancel existing orders or issue refunds; those require a separate organizer decision.
