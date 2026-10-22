# Personal account settings

The authenticated `/account/profile` page now has Profile, Notifications, and Privacy & security sections. Section links use the existing route with a `section` query parameter.

## Experience

- A constrained 1040px layout, account navigation, compact 80px avatar, hairline sections, and shared Save/Discard controls replace the broad panels.
- JPEG/PNG/WebP photos up to 2 MB can be cropped with zoom, drag, and keyboard position controls. Upload shows transmitted progress followed by processing; a failed upload retains the crop for retry. Photos save immediately and update the header avatar. Discard applies to draft fields, not photos already saved.
- Personal fields include a read-only sign-in email, country-aware phone entry, inline validation, and optional gender.
- City suggestions load after a debounce. Choosing a result fills state and country; device location requires an explicit action. The map stays collapsed until requested. Precise coordinates remain opt-in; clearing the location and saving removes it.
- Interest categories persist in the account. An explicit discovery link browses the selected interests; other events are not automatically hidden.
- Email and WhatsApp switches control event reminders. Existing booking consent and transactional delivery rules remain in force.
- Dirty drafts show Save/Discard, support Ctrl/Cmd+S, preserve failed edits, and warn on ordinary link navigation and reload/close. Successful sub-requests update their own baseline if a later sub-request fails.

## Privacy and security

`GET /api/profile/security` returns only the authenticated user's supported sign-in provider names and email-verification status. Email/password accounts can request a Firebase password reset; provider accounts are directed to their provider. Changing the sign-in email is not implemented.

`GET /api/profile/privacy` downloads explicitly selected account fields and owned booking summaries. It excludes Firebase IDs, authentication secrets, payment sessions, ticket QR codes, and other buyers' records. Responses are private and not cached.

`POST /api/profile/privacy` records a **deletion request**, not an immediate deletion. Same-origin checks, authentication, a bounded empty JSON payload, and an atomic delivery lease protect the action. The existing email provider notifies the authorized administrator. Requests remain durable if email fails; the user can retry after 60 seconds. Successful repeats return the existing request without resending. The administrator must review and complete the request manually, including any transaction-retention obligations. There is no automatic deletion or background retry worker for these requests.

Migration `20261022120000_profile_privacy_interests` adds interests and three nullable request/delivery timestamps to User. It is additive and compatible with the previous application image. Apply it before starting the new image; an application rollback should leave these columns in place.

## Verification and limits

The dedicated local database `raunak_profile_20261022` contains disposable test records only. Integration tests verify data isolation, persisted interests, concurrent deletion requests, and email failure/retry with mocked delivery. Browser tests use the real components and intercepted API responses, never production accounts.

Release checks: 125 unit tests and nine profile/privacy PostgreSQL integration tests passed. All seven browser tests passed with the real AccountShell and marketing stylesheets, including 24 combinations of settings section, theme and viewport with no detected axe violations or horizontal overflow. Type checks, focused lint, theme color policy and all 36 theme-token contrast pairs passed. The local screenshot comparison uses the prior component and new component under matching styles and layout.

Native browser Back/Forward between client-side history entries is not intercepted. Real camera/device geolocation hardware, Google account settings, Firebase reset email delivery, live photo storage, and live deletion-request mail delivery require separate acceptance checks. Full repository lint has pre-existing unrelated failures in the ignored `garba-match` application; changed files are linted independently.

Local screenshot comparison and new section views: `artifacts/personal-settings/index.html` (ignored artifacts). These use a clearly labelled sample account in a development-only fixture; the fixture returns 404 in production.

Run checks:

```sh
pnpm typecheck
pnpm exec vitest run tests/unit
RUN_PROFILE_PRIVACY_INTEGRATION=true DATABASE_URL=postgresql://USER@localhost:5432/TEST_DATABASE pnpm exec vitest run tests/integration/profile-privacy.test.ts tests/integration/profile.test.ts
pnpm exec playwright test tests/e2e/personal-settings.spec.ts
pnpm build
```

The privacy integration suite requires a localhost test database whose name starts with `test_` or `raunak_profile_`. It is opt-in and never targets production by default.
