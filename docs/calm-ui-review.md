# Calm utility UI pass

## Scope and sweep

| Page | Problem found | Applied or deferred |
| --- | --- | --- |
| /account | Marketing greeting, full-width saved rows, scattered actions, loud hover | Plain My plans header, shared section headings, capped poster grid, overlay heart/date, quiet organizer/share. Existing counts and data filters retained. |
| /saved | Marketing headline, default cards, empty-state decoration | Shared header, saved card variant and calm heart instruction. |
| /my-tickets | Promotional eyebrow/header and inconsistent error/loading title | Shared page header in signed-in/out, error and loading states. Existing ticket retrieval/actions retained. |
| /account/profile | Existing profile form uses compact controls; typography squeeze | Shared workspace heading/section tracking corrected. Deeper form restructuring deferred to avoid changing onboarding/profile save contracts in this scope. |
| /dashboard/settings/profile | Marketing hero, nested panels, detached uploads, no visible dirty save | Shared sections, responsive settings navigation, live preview and dirty Save/Discard bar. |
| /dashboard/settings/messages | Isolated heading and missing sibling links | Shared page header and real organization-scoped settings navigation. Message handlers untouched. |
| /dashboard/settings/whatsapp | Promotional eyebrow and missing sibling links | Shared header and settings navigation. Linking/delivery controls untouched. |
| /dashboard/team | Duplicate back arrow risk, oversized header gap and boxed member list | Shared back/header, sibling navigation, hairline member list. Role checks retained. |
| Event Details, Tickets, Messages, Team, Settings | Disconnected h1 sizing and descriptions | Shared page headers, duplicate descriptive copy removed. |
| Event Check-in | Separate large heading convention | Shared compact page header. Gate outcomes, scanner and manual lookup unchanged. |
| Event Overview, Attendees | Operational status/export headers already functional | Scoped heading tracking/type size corrected. Status badge/export action retained. |
| Event Media | Dedicated image editor, crop/reorder/upload interactions | Existing behavior retained; full media-panel restructuring deferred because this pass targets shared surfaces and organizer branding; changing nested editors would require separate interaction coverage. |
| Discover, organizer profile, related-event cards | 4:5 fit posters had blank background bars | EventCard uses the same-image blurred backdrop with readable uncropped foreground. |

## Data limitations

Saved queries currently include only upcoming public listings and provide minimum visible ticket price. Past saved, cancelled, sold-out, sales-window and price-change states are deferred: the relevant history/availability fields are not passed into these cards, and this task explicitly preserves data/business contracts. No fabricated statuses are shown. Existing image processing crop coordinates are baked into delivered variants; no unsupported focal position field was introduced.

## Foundations

See `docs/ui-components.md` for component usage and tokens. Spacing scale4/8/12/16/24/32/48/64; utility headings below28 use zero tracking; display titles use -.01em maximum. Word spacing normal. Existing themes/palette preserved.

Before account screenshots: `/tmp/raunak-calm-before-account-{375,768,1440}-{light,dark}.png`. After: `/tmp/raunak-calm-after-account-{375,768,1440}-{light,dark}.png`. Isolated dev-only real-component fixture has explicit sample data and returns404 in production. No real user events, uploads, messages or bookings are modified by browser checks.

## Organizer profile (U2)

The profile editor now uses a compact page header, public URL Copy/Open actions, real settings links, section anchors and completeness links. At 1280px and above it has a settings rail, plain field sections and a sticky live preview. At smaller widths Preview opens a native modal drawer/bottom sheet with Escape, focus containment and trigger focus restoration. Empty cover controls use readable paper tones with the upload action inside the drop area. Logo/cover changes persist immediately, as before, and announce that behavior. Uploads show actual transmitted percentage followed by processing; file errors can be retried. Duplicate operations and editing during a save/upload are disabled.

Draft profile fields, highlights and cover position are compared against the last saved draft. The sticky Save changes/Discard bar appears only when dirty. Save supports Ctrl/Cmd+S and announces success; failure preserves edits. Discard restores highlights and other draft fields, while keeping images already saved by the immediate upload endpoints. A cover upload also updates the saved baseline of the position sent to its endpoint. Existing private image keys are rendered through public image proxy routes rather than exposed as relative image URLs.

Navigation protection covers normal same-origin link clicks and page reload/close via beforeunload; modified links and local anchor navigation keep their native behavior. **Native browser Back/Forward between existing client-side history entries is not intercepted:** Next's App Router has no supported before-pop guard, and this pass avoids monkeypatching router/history internals. Saving or discarding before using browser history remains necessary.

The API does not support editing organization display name or per-contact visibility here, so display name is read-only and contact fields retain their current public behavior. Existing profile API access remains OWNER/ADMIN only. Non-editors receive the server's informative restricted state rather than gaining access to private organization data. A read-only component state is verified in the isolated fixture for future permitted callers. Free-form focal dragging and the event-image crop modal are deferred: that modal persists event-specific crop fields, whereas organizer covers currently support only Top/Center/Bottom. Logo processing retains its existing server crop behavior. No route, API, schema or role contract was changed.

`tests/e2e/calm-profile.spec.ts` covers draft save/discard, failed saves, link/reload guards, keyboard file selection, upload retry/replace/remove, logo operations, invalid files, highlight order/discard, read-only controls, preview focus/Escape, zero axe violations and no horizontal overflow at 320/375/768/1280/1440 in both themes. Network responses are intercepted, so these checks verify the real client without uploading to storage or modifying production data. Native img warnings remain for existing processed media/proxy endpoints and external highlight URLs.

Before profile screenshots: `/tmp/raunak-calm-15fVY4lO/profile-before-{375,768,1440}-{light,dark}.png`. After: `/tmp/raunak-calm-15fVY4lO/profile-after-{375,768,1440}-{light,dark}.png`.

## Verification

- Type checks and focused lint pass. The full unit suite passes (119 tests).
- All 10 combined profile/saved browser tests pass, including failed Undo recovery, upload retry, keyboard controls, and responsive accessibility checks in both themes.
- Theme color checks and all 36 token contrast pairs pass.
- Full repository lint remains blocked by existing errors in the unrelated ignored `garba-match` application. No unrelated files were changed to suppress those errors.
- The broad integration run did not pass in this local environment: database-dependent tests failed with Prisma errors. It is not counted as a successful integration gate. No production database tests were run.
- Independent visual review passed at 375/768/1440 in both themes after the tablet navigation and compact logo fixes. Authenticated AccountShell and live media persistence were not independently browser-tested.
- Before/after screenshot comparison: `artifacts/calm-ui/index.html` (local, ignored artifacts).

## Next treatment candidates

1. Event Media: simplify the specialized crop, reorder and upload panels with dedicated interaction coverage.
2. Account profile: align the deeper form structure while preserving onboarding behavior.
3. Ticket management: apply the same quiet hierarchy to the ticket editor and inventory details after a focused workflow review.
