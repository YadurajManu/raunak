# Contribute to Raunak

Help make events easier to discover, host and attend. The repository's `CONTRIBUTING.md`, `SECURITY.md` and `LICENSE` remain the project policies; this page is a reading guide to them.

## Start with a focused change

Use the [local installation guide](installation.md) with a disposable development database and your own provider accounts. Read `AGENTS.md` and the relevant implementation before editing. For framework changes, consult the Next.js documentation shipped with the installed package.

For a bug report, include the route, expected/actual behavior, reproduction steps, browser and viewport. Add redacted screenshots when they explain the problem. Discuss larger product or architecture changes in an issue before substantial implementation.

## Preserve the important boundaries

- Workspace and event permissions must remain server-side.
- Ticket and order access must preserve booking ownership.
- Payment application and ticket creation must stay idempotent.
- Admission QR links and private storage must not become public sample assets.
- Provider secrets must stay out of Git, logs and browser bundles.
- Interface work should support light/dark themes, visible focus and mobile layouts.

## Verify and explain the change

Run the checks relevant to your change and record the results. The development guide lists type checking, lint, unit/integration checks, production builds and Playwright. Do not call an unexecuted check passed or treat a mock as proof of remote delivery.

A useful pull request explains the concrete problem, final behavior, how it was verified and any migration/deployment requirement. Include mobile/desktop screenshots for visual changes. Keep unrelated edits, private records, generated reports and credentials out of the diff.

## Improve documentation

Public guides live in the explicit `docs/public/` set and are rendered at `/docs`. Navigation, search and previous/next links should use the shared page metadata rather than an unbounded filesystem scan. Review technical claims against source before publishing them.

When refreshing product screenshots, use fictional clearly labeled local sample records. Do not include real accounts, payment secrets or usable admission QR. Keep the raw capture/verification reports in ignored artifacts and check in only the optimized public assets that the docs actually reference.

## Report security issues

Do not put exploit details, credentials, private ticket links or customer information in public issues or pull requests. If GitHub private vulnerability reporting is available, use the repository's Security → Report a vulnerability flow. Otherwise, contact the maintainer through GitHub to arrange a private channel first.

Include the relevant commit, affected component, reproduction steps using accounts you control, impact and a suggested fix if available. The project does not promise a response-time or security-support SLA. Permission to use the source does not authorize testing other people's deployments.

## License and project links

Raunak is provided under the MIT License, copyright 2026 Raunak contributors. Preserve its copyright, permission and warranty notices when redistributing the software. Contributions follow the same license; third-party dependencies keep their own terms.

- [Contribution policy](../../CONTRIBUTING.md)
- [Security reporting policy](../../SECURITY.md)
- [MIT License](../../LICENSE)
- [Source and issues](https://github.com/YadurajManu/raunak)
