# Documentation assets

| Asset | Source | Content |
| --- | --- | --- |
| `readme-banner.svg` | Code-native SVG using Raunak's cream, ink, coral and forest palette | Brand artwork. The ticket is illustrative and contains no QR code. |
| `discover.webp` | Local `/style-guide/docs-preview?screen=discover` | Current `DiscoverFilters` and `EventCard` components, with fictional events and existing repository sample artwork. |
| `organizer.webp` | Local `/style-guide/docs-preview?screen=organizer` | Current `EventForm` with fictional workshop details. |
| `check-in.webp` | Local `/style-guide/docs-preview?screen=check-in` | Current `CheckinScanner` with a browser-intercepted fictional attendee lookup. No ticket is issued or admitted. |
| `product-tour.gif` | The three checked-in WebP previews above | A short slideshow of the real preview screens. It does not simulate a live interaction; all sample content remains fictional. |

Screenshots were captured on 19 October 2026 at a 1440px viewport in light mode. Each screenshot includes an explicit sample-data label. The sample attendee uses `example.test`; the shown ticket code is not a signed admission token. These images show interface behavior, not actual customers, sales, attendance or provider acceptance.

To refresh: start `pnpm dev` and run `node --import tsx scripts/capture-docs-assets.ts` in another terminal. The script accepts `DOCS_CAPTURE_URL` for another localhost development port, rejects remote hosts, intercepts API requests and writes optimized WebP files here. Intermediate PNG files go to the ignored `artifacts/docs-assets/` directory. The component preview returns 404 in production.

Do not replace these with production screenshots containing personal information, credentials, booking references, or usable admission QR codes.
