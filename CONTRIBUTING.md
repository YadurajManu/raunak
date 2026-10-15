# Contributing to Raunak

Thank you for helping make events easier to discover, host and attend.

## Start here

Follow the [README setup](README.md#getting-started) using development provider accounts and a development database. Never run fixtures or seed scripts against customer data.

For a bug report, include the affected route, expected/actual behavior, reproduction steps, browser and viewport, and redacted screenshots where helpful. Discuss large features or architecture changes in an issue before starting substantial work. Use [private reporting](SECURITY.md) for security issues.

## Making a change

1. Work in a focused branch and keep the change limited to its purpose.
2. Read [AGENTS.md](AGENTS.md) and relevant project docs. For Next.js changes, consult the documentation shipped with the installed version.
3. Reuse shared components, provider abstractions and validation patterns.
4. Preserve tenant boundaries, ticket ownership, payment idempotency and private storage access.
5. Check light/dark themes, keyboard interaction and mobile layouts for UI changes.
6. Add meaningful tests for changed behavior and update docs when setup or functionality changes.

## Checks

With development services running and migrations applied:

```bash
pnpm exec prisma generate
pnpm exec next typegen
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

For browser changes, also run `pnpm test:e2e` after installing Chromium with `pnpm exec playwright install chromium`. Use separate test data and provider accounts. Record intentionally skipped tests and checks you could not run.

## Pull requests

Explain what changed, why it helps, how it was tested and any migration or deployment requirements. Include desktop/mobile screenshots for visual changes, and light/dark examples when relevant. Avoid unrelated formatting, generated artifacts, customer data and credentials in the diff.

Contributions are provided under the [MIT License](LICENSE). Keep copyright and third-party license notices intact. Be respectful, specific and constructive in discussions and reviews.
