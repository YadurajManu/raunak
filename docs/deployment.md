# Fleet deployment

Raunak runs at `https://raunak.yaduraj.me` on the existing `fleet-cp` server.
The private source repository is `https://github.com/YadurajManu/raunak`.

## Services

`deploy/compose.yml` defines the Next.js website/API, media worker, PostgreSQL,
Redis, and Garage S3 storage. Each has its own Raunak container/volume. Database,
Redis, and storage ports are not published on the host.

Cloudflare Tunnel terminates HTTPS and forwards this hostname to the existing
Fleet Caddy container. Caddy sends `/raunak-media/*` to Garage and other paths to
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

This creates a disposable Firebase account, checks email verification enforcement,
new-user onboarding, saved profile preservation, returning-user routing, and
logout, then removes the Firebase and database records. Google popup consent must
also be checked interactively with a real Google account.

## Current limits

This deploys the implemented application. Checkout/payments, issued QR tickets,
notifications, scanning, and reporting remain separate development work. Location
search/reverse lookup requires a Geoapify key; manual location entry still works.

Database and object storage currently live on one server. Configure off-server
backups before accepting important customer data. Rotate the Firebase key shared
in chat, replacing only the ignored server credentials. Railway is no longer used.
