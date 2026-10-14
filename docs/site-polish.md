# Shared UI/UX polish

This release focuses on the attendee and organizer interfaces. It introduces no payment, payout or database changes.

- Public pages use a dedicated navigation row on mobile, keeping Discover Events, My Tickets and Saved visible alongside profile/sign-in and theme controls.
- Shared navigation links track the current route, including nested wallet pages and exact organizer event tabs. Active links expose `aria-current` and maintain visible focus indicators.
- Workspace home has a compact, descriptive heading. Account headings, section spacing and empty states follow a more consistent rhythm.
- Sidebar, event tabs, forms and buttons have consistent touch targets. Mobile inputs use readable sizing to avoid browser zoom. Long menus and horizontal event tabs stay inside the viewport.
- Light/dark theme and attendee/organizer switching remain accessible on mobile.

Verification: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, and `pnpm exec tsx scripts/verify-site-polish.ts` against the matching local application. The browser check covers account, profile, workspaces, event list, event creation, media, ticket editor, discovery, ticket wallet and saved events at desktop/tablet/mobile widths, with light/dark screenshots in `artifacts/site-polish/`.

The browser script uses disposable local records and never creates payments or sends customer messages. Screen-reader and physical-device testing are not included in this pass.
