# Calm utility UI

Import named components from `@/components/ui`. Shared CSS is `src/app/(marketing)/calm-ui.css`, loaded last in the marketing layout. The dev-only `/style-guide/calm-ui?view=components` shows every foundation in both themes; production returns 404.

| Component | Usage |
| --- | --- |
| PageHeader | One title, short description, optional backHref/backLabel and actions. It provides the back arrow; labels must not include arrows. |
| SectionHeader | Modest h2 with optional numeric count and nearby actions; no decorative eyebrows. |
| Section | Hairline and spacing for related form fields. Never wrap in another card. |
| Card | Only a distinct object or preview, radius 12px. |
| FormField | Label above; hint and counter below. Pass `aria-describedby` from the input to `{htmlFor}-hint` / `{htmlFor}-error`; set `aria-invalid` for errors. |
| StickySaveBar | Render with draft dirty/busy state and the real form ID. Discard resets only unsaved fields. |
| ImageField | Keyboard file input/button and supplemental drop handling. Existing upload validation remains the caller's responsibility. |
| SegmentedControl | Native labelled radio group, controlled `value`, `options` and `onChange`. |
| StatusChip | Factual neutral, success or warning status only. |
| InitialsAvatar | Actual image or paper/ink initials; no decorative random colour. |
| SettingsNavigation | Existing organization-scoped Profile, Team, WhatsApp and Message defaults links. |
| EventCard variant="saved" | Poster-first collection card, maximum 360px. Separate heart/share/organizer actions above a stretched event link. |

Spacing tokens: `--space-{4,8,12,16,24,32,48,64}`. Type tokens: helper13/body14/section24/title40. Utility section headings use zero tracking; display headings ≥40px use -.01em maximum; word spacing is normal. Existing palette/font tokens provide both themes. Controls target44px. Media16px, cards12px, controls8px radius. Hover changes lift/border/underline, never every text colour; reduced-motion removes transforms.

Saved removal uses the existing endpoint optimistically with rollback on failure. Undo stays available for eight seconds, then the collection and count refresh. Undo cancels that refresh. No booking, ticket, availability, pricing-history or saved-event visibility contracts are changed.
