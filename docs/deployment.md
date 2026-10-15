# Fleet deployment

Raunak runs at `https://raunak.yaduraj.me` on the existing `fleet-cp` server.
The private source repository is `https://github.com/YadurajManu/raunak`.

## Services

`deploy/compose.yml` defines the Next.js website/API, media worker, PostgreSQL,
Redis, and Garage S3 storage. Each has its own Raunak container/volume. Database,
Redis, and storage ports are not published on the host.

The optional `whatsapp` Compose profile adds the private long-lived Baileys gateway. Its Dockerfile target is `wa-gateway`; it has no public port or fleet/tunnel network. App/worker calls use `http://wa-gateway:3101` plus an internal API key. Keep it disabled until configuration and spare-number acceptance are complete. See [the gateway runbook](whatsapp-gateway.md) for build, activation, rollback and key handling.

Cloudflare Tunnel terminates HTTPS and forwards this hostname to the existing
Raunak Caddy container. Caddy sends `/raunak-media/*` to Garage and other paths to
the Next.js service. S3 signatures keep the public hostname and original path.
Original uploads are private; `/api/media/*` signs only processed artwork URLs.

Server code lives in `/opt/raunak`. The mode-600 `.env` and `garage.toml` contain
credentials and must never be committed or copied into an image. The Dockerfile
accepts only public Firebase configuration as build arguments.

## Update

Upload the committed source, then build and migrate before restarting services:

```sh
git archive HEAD | ssh fleet-cp 'tar -x -C /opt/raunak'
ssh fleet-cp 'cd /opt/raunak && docker compose --env-file .env -f deploy/compose.yml build web'
ssh fleet-cp 'cd /opt/raunak && docker compose --env-file .env -f deploy/compose.yml run --rm web pnpm db:migrate'
ssh fleet-cp 'cd /opt/raunak && docker compose --env-file .env -f deploy/compose.yml up -d web worker'
```

Inspect status using `docker compose --env-file .env -f deploy/compose.yml ps`.
Do not use `down -v`: it deletes persistent application data.

## Verify authentication

```sh
ssh fleet-cp 'docker exec -e AUTH_SMOKE_URL=https://raunak.yaduraj.me raunak-web pnpm exec tsx scripts/verify-auth.ts'
```

This creates a disposable Firebase account, checks immediate sign-in without email verification,
new-user onboarding, saved profile preservation, returning-user routing, and
logout, then removes the Firebase and database records. Google popup consent must
also be checked interactively with a real Google account.

## Current limits

This deploys the implemented application. Checkout/payments, issued QR tickets,
notifications and scanning are implemented. Live payment and notification provider activation and reporting verification remain outstanding. Location
search/reverse lookup requires a Geoapify key; manual location entry still works.

Database and object storage currently live on one server. Configure off-server
backups before accepting important customer data. Rotate the Firebase key shared
in chat, replacing only the ignored server credentials. Railway is no longer used.

## Profile and event experience release

Remembered sessions use a secure HTTP-only cookie for fourteen days. Unchecking
Remember me leaves a browser-session cookie. Passwords and session tokens are not
stored in localStorage. Returning users visiting `/`, `/login`, or `/signup` go to
their dashboard, or onboarding if their profile is incomplete. Existing five-day
sessions retain their original expiry until the next sign-in.

The dedicated profile editor supports private profile photos (JPEG/PNG/WebP,
2 MB, cropped and resized to 512 px with metadata stripped) and optional precise
location storage. Custom photos are preserved on subsequent sign-in.

Event PDFs are private S3 objects, bounded to 10 MB and ten files per event. The
application permits public downloads only while the event is published; drafts
require an authorized organizer. PDF downloads are attachments with nosniff.
Published brochures should not contain private information. Venue pins are public;
profile pins are private. Discovery, event pages and organizer pages share the
landing page theme, fonts and light/dark preference.

Migration `20261014100000_event_documents` only adds an Event JSONB column with an
empty-array default. Run migrations before restarting the new web and worker.
Because organizer/discovery/event routes moved into the marketing route group,
remove the obsolete server source folders `src/app/dashboard`, `src/app/discover`
and `src/app/e` before extracting this release archive; archive extraction alone
does not remove old files.

Before deploying, tag the currently running image `raunak:previous-experience`
and take a mode-600 PostgreSQL dump. If login, profile saving or event publishing
fails after release, retag that image to `raunak:latest` and recreate web/worker;
the additive migration is compatible with the prior version. Do not drop the new
column or restore a database dump over subsequent customer writes.

Local checks: `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`.
`scripts/verify-experience.ts` exercises a disposable account, remembered return,
profile/photo saving, event creation, PDF/image uploads, tickets, publishing and
public discovery on desktop/mobile. It uses the local database and storage and
must run against the matching local application, not the production server.
The production authentication smoke script also checks remembered and browser-only
cookie modes and redirects. No live customer or organizer records are used.
