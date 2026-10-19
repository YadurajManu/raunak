# Maintain the public documentation

The documentation website uses trusted repository Markdown, an explicit page map and small interaction components. It does not discover and expose every file under `docs/` and does not execute MDX from visitors.

## Content ownership

- `docs/public/*.md` contains the reviewed public guides.
- `src/lib/docs.ts` defines the public navigation/page metadata, heading anchors and search matching.
- `src/server/docs.ts` loads only the allowlisted source files.
- The dedicated `/docs` route/layout and docs components render those files without requiring Firebase or application database access.
- `docs/documentation-evidence.md` is a source-review working table; it is intentionally not in the public route map.
- `README.md` is the repository entry point; link to the canonical guides instead of copying long operational instructions.

See the actual file exports when making a change. Keep the explicit allowlist and validated slugs; never derive arbitrary filesystem paths from a URL or search query.

## Add or update a guide

1. Trace the implementation for every behavioral claim. Distinguish implemented code, local/mock verification, configured providers and observed external acceptance.
2. Create or edit `docs/public/<slug>.md`, beginning with one `# Title`, a short introduction and clear `##` sections. Use ordinary Markdown, fenced code and tables.
3. Add the page's title, description, group and slug to `src/lib/docs.ts` if it is new. This is the shared navigation/search/previous-next source.
4. Use relative sibling links such as `installation.md` and `contributing.md#report-security-issues`. The website maps known Markdown links to docs routes while GitHub can read them directly.
5. Use `../../CONTRIBUTING.md`, `../../SECURITY.md` and `../../LICENSE` for repository policy links. Review any link to operational material before making it public.
6. Rebuild and run the documentation checks. Search entries are derived from the same metadata and Markdown headings; there is no remote search service or hand-maintained search database to update.

Supported callouts use GitHub-style markers:

```markdown
> [!IMPORTANT]
> Keep the worker running for ticket preparation and delivery.
```

Heading anchors use the shared slug rules. If a heading changes, update all references to its old anchor. Keep shell commands exact and do not include terminal prompts in copyable blocks.

## Diagrams

Architecture and lifecycle diagrams explain source-reviewed relationships. Mermaid remains readable in repository guides; the docs renderer supplies an accessible static presentation with explanatory text. Keep a textual description so no reader needs hover or animation to understand a flow.

Limit complexity to a few nodes per row. Do not put API keys, real users, internal account hosts or performance claims in diagrams. No benchmark or uptime graphic should exist without a real dataset and recorded method.

## Refresh product assets

Use an isolated local development/test setup and clearly labeled fictional records. Capture the existing product components or routes rather than drawing a replacement dashboard. Do not seed production or send real payment/message requests for documentation artwork.

Raw screenshots and reports belong under the ignored `artifacts/` directory. Check in only optimized, referenced images under `public/docs/` or the documented asset directory, keeping dimensions and useful alt text. Remove or replace usable admission QR, real accounts, phone numbers, tokens and payment information before public capture.

The current assets live in `public/docs-assets/`. Their [provenance notes](../public/docs-assets/ASSETS.md) identify each actual component and its sample data. With `pnpm dev` running, refresh all three images using:

```bash
node --import tsx scripts/capture-docs-assets.ts
```

The capture script accepts only a localhost origin, intercepts browser API requests and uses `/style-guide/docs-preview`. That preview is development-only and returns 404 in production. Source screenshots go to `artifacts/docs-assets/`; optimized WebP images are checked in. Update `next/image` dimensions and social-image metadata if an asset's size changes.

Refresh the README banner using the checked-in source asset and existing brand geometry/tokens. Recheck light/dark readability at GitHub's displayed size. When changing an asset path, update README and website references together.

## Verify before publishing

Run the real repository commands for type checking, focused lint/tests and the production build. Documentation browser checks should cover the overview and a code/table-heavy guide at 360, 390, 768, 1280 and 1440 pixels in both themes. Check search (including no results), mobile menu, Escape/focus restoration, heading links, code copy and previous/next links.

```bash
pnpm typecheck
pnpm exec eslint src/app/docs src/components/docs src/lib/docs.ts src/server/docs.ts tests/unit/docs.test.ts tests/unit/docs-links.test.ts tests/e2e/docs.spec.ts
pnpm exec vitest run tests/unit/docs.test.ts tests/unit/docs-links.test.ts
pnpm exec playwright test tests/e2e/docs.spec.ts --workers=1
pnpm build
```

Playwright creates overview and installation-guide screenshots under `artifacts/docs/` for all five viewport widths in both themes. The docs source/link tests check the explicit route map, anchors, search matching and local README image paths. The existing repository-wide checks remain useful, but distinguish unrelated workspace failures from documentation regressions.

Verify `/docs` with sessions and external provider credentials unavailable. Check at least one existing product route for CSS/layout leakage. Validate all internal Markdown links, asset paths and explicit slugs; reject unsupported path traversal rather than attempting a filesystem lookup.

Record blocked checks and their exact cause. The static web health response is not proof that database, Redis or providers are available. Source-reviewed integration diagrams and mocked tests never replace live provider/device acceptance.
