# Universal navigation and Discover

## Audit and architecture

Previously Raunak had three top-level implementations: `MarketingNav` for the landing page, `PublicHeader` repeated by public pages, and a separate header in `AccountShell`. Account sidebars repeated public navigation, navbar padding/heights differed, and profile dropdown instances remounted across pages.

The marketing application layout now owns exactly one `GlobalNavbar`. Landing, Discover, public event/organizer pages, checkout, booking confirmation, tickets, saved events, account/profile, organizer/workspace pages, editing/settings, legal pages and workspace invitation acceptance inherit it. Old header components and page-level calls are removed. The logo always links to `/`; existing signed-in dashboard routing remains unchanged.

Authentication, onboarding, style-guide previews and signed admission QR pages retain focused shells. Organizer workspaces use a secondary horizontal navigation row, with existing role-filtered event tabs beneath it. Attendee pages no longer repeat global links in a sidebar. API routes have no application navigation.

Navbar dimensions and logo alignment are fixed per breakpoint: 76px desktop inner row and 124px at tablet/mobile, plus the border. Main navigation, profile, theme and organizer/attendee switch use the same implementation everywhere. Profile menus dismiss on Escape, outside clicks and navigation. Private avatar changes reset image fallback state.

## Discover

- Editorial hero, compact search, icon-based category rail and invitation-style event cards using real optimized covers/posters.
- Debounced server suggestions for events, venues and organizers, with accessible combobox keyboard navigation, clear action, loading/empty/failure messages and direct selection routes.
- Existing server filtering, URL state, pagination, city recents, saved events and sharing remain in place. Online discovery applies directly.
- Zero inventory has an actionable empty state. One to three unfiltered results stay at reasonable card widths beside a relevant host invitation. No listings or activity indicators are fabricated.
- With at least eight real results, the first page can group remaining listings into up to two contextual sections (weekend, the user's known city, free entry, workshops, music or recently added). Each listing appears once; sparse or filtered results stay in the normal grid. Sections use existing paginated query results, not an intelligent recommendation claim.
- Category values remain the existing backend taxonomy. College/comedy/technology are not presented as precise independent filters because those values do not exist in the current taxonomy.
- Publishing review adds advisory low-resolution, description and unlisted-visibility guidance. Existing validation and public/test-event safeguards remain unchanged.

## Verification and screenshots

`pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`; marketing Playwright tests; authenticated `scripts/verify-site-polish.ts`; full `scripts/verify-experience.ts` booking/media/QR workflow.

The layout script checks one header, one profile menu, consistent logo X position and header height, no overflow, active navigation and profile menu dismissal across attendee and organizer pages. Before/after screenshots use identical desktop/tablet/mobile viewports in `artifacts/universal-before/` and `artifacts/universal-after/`, with disposable local authenticated records. The full workflow verifies real suggestions plus empty/error fallbacks, booking and private tickets. No live customer payments or messages are used.

## Deployment

No database migration or route URL changes. The invitation route reuses the same application layout through a layout re-export. Retain the previous container image for rollback; database restoration is unnecessary.
