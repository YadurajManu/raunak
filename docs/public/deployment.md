# Deployment considerations

The repository provides a Dockerfile and an installation-specific production Compose definition. A production release needs its own configured infrastructure, provider accounts and secret handling; the Compose file is not a generic one-click deployment.

## Understand the supplied installation

The Dockerfile uses Node 24 and pnpm 10.12.4, installs pinned workspace dependencies, generates Prisma and builds the Next.js web target. The web and worker services use the application image but run different commands.

`deploy/compose.yml` defines the web process, worker, PostgreSQL, Redis, S3-compatible storage and proxy. Its networking, proxy and storage configuration assume an existing installation. The optional `whatsapp` profile adds a long-lived gateway without a public application port.

Adapt domains, networking, volumes, storage and proxy configuration to infrastructure you control before using it. This public guide intentionally omits account-specific access hosts and server paths.

## Prepare configuration

Set the application origin, server-side database/Redis/storage values, independent signing/encryption secrets and Firebase configuration. Configure only the payment and delivery providers you intend to use. Public Firebase build arguments and server service-account secrets are different things.

Keep environment files, storage configuration, database dumps and secret-manager exports out of Git and images. The Docker build context must not include private environment files or generated production backups.

For paid checkout, configure the production Cashfree account, permitted website domain and signed payment webhook. For outbound mail, verify the sender/domain at the selected provider. Complete official WhatsApp template/sender activation or deliberate gateway acceptance separately.

## Release order

1. Record the exact source commit and preserve the currently running image.
2. Take a private database backup and confirm you can restore it in an isolated environment. Back up storage and signing/encryption settings too.
3. Build the application image from the intended committed source.
4. Apply reviewed migrations using `pnpm db:migrate` against the intended database.
5. Start/recreate the web and worker services with the matching image and runtime environment.
6. Verify public pages, sign-in and a disposable test workflow appropriate to the changes.

These are operational steps to review and execute in your environment, not commands executed by the documentation site.

## Runtime checks

Check container/process status, web/worker logs, database and Redis reachability, and storage behavior. The `/api/health` route returns a static response; it is not a dependency readiness probe.

Verify published discovery, authenticated booking ownership, QR/PDF retrieval and event permissions with controlled accounts. A live charge or outbound message should only be part of an explicitly authorized provider acceptance plan.

## Rollback

Choose rollback triggers before release, such as broken login, checkout failures or ticket lookup errors. Preserve the prior image so the web and worker can be restored together. Check migration compatibility first; do not assume every migration is reversible.

> [!WARNING]
> Do not run `docker compose down -v` on an installation whose data you need. Do not restore an old database dump over later customer writes as a routine application rollback.

## Operate the worker and gateway

The worker must stay running for artwork processing, PDFs, notifications and expiry maintenance. Monitor failed queue jobs and durable delivery errors; restarting the web alone does not process queued work.

Run at most the intended single active linked-gateway owner for a WhatsApp session. Preserve its encryption key, keep its internal API private, and follow the repository gateway runbook for deliberate disconnect, recovery and key rotation. Email delivery remains a separate path.

## Scope of verification

Source code and local tests cannot establish your backup durability, merchant settlement, provider deliverability, capacity or physical entrance network. Keep an operator-owned acceptance record for the deployed environment and real devices before an event depends on them.
