# Media & Lineup redesign

## Audit

The previous page repeated four upload boxes, kept processing bars after completion, and gave each image a large two-column card with its role, alt text and edit controls permanently visible. An always-open people form occupied a separate rail. PDF controls added another large section. Image uploads had progress, but retry/cancellation and ambiguous confirmations could leave users unsure whether a file had saved.

## Implemented workflow

- One Add media dialog: choose a role, drop/select multiple files, inspect previews, upload, cancel or retry individual files. Completed rows have a small status rather than a progress bar.
- Separate compact cover/poster slots, a five-column desktop gallery (about 170px thumbnails), and compact lineup rows. Mobile uses three gallery columns where space allows.
- Default image cards expose only selection, a thumbnail, a drag handle and an actions menu. Details, roles, alt text, crop and replacement appear in focused dialogs. Full-image preview and confirmed bulk deletion are available.
- Image and lineup ordering persist through existing image ordering APIs and a new authenticated lineup ordering endpoint. Keyboard/touch users have move controls; failed saves restore the previous order.
- Person dialogs support preset/custom roles, bios, optional links, direct photo uploads, existing photo selection and cropping. A photo can be shared without changing its media role.
- Replacement preserves the old original in the gallery, takes over its display role and preserves person photo associations. Cropping continues to preserve originals.
- Documents are available through a compact disclosure. Unsaved edits and remaining uploads warn before dismissal/reload. Closing after server confirmation refreshes the library so background processing remains visible.

## Reliability and limits

Confirmation retries return the same image, including simultaneous confirmations. Only an already-confirmed upload can be replayed after token expiry; a new confirmation still requires an unexpired signed token. Ordering and replacements use event-level database locks. Replacement replay is idempotent. No schema migration is needed.

Duplicate selection checks use filename, size and modification time rather than a stored content hash. At the existing 20-image limit, retaining the previous image means a replacement needs one free library slot. Upload time estimates remain approximate; processing reports actual format-generation progress.

## Verification

All 61 tests, lint, type checking and the production build pass. Unit/integration coverage includes file validation, private preview access and content validation, concurrent confirmation, reversible cropping, original preservation, replacement/photo association preservation, lineup ordering/access checks, and the existing ticket/payment/email flows. Browser verification covers batch uploads, alt/role edits, cropping and nested-dialog discard protection, replacement, direct and existing person photos, lineup/gallery ordering (including dragging), cancellation, invalid/duplicate selections, failed-upload retry, deletion, refresh persistence and responsive layouts. Laptop gallery thumbnails measured 168px.

Screenshot artifacts are stored under `artifacts/`: `media-before-desktop.png`, `media-after-desktop.png`, `media-after-laptop.png`, `media-after-mobile.png`. They use disposable test uploads. The structural comparison is two large image columns and permanent forms versus five compact columns and editing on demand.
