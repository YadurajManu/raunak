# Entrance check-in

Open **Workspace → Event → Check-in**. Owners and admins can use the gate; managers and check-in staff must also be assigned to that event. Use HTTPS, or localhost during development, for camera access.

- **Scan:** choose Start camera, allow camera access, and hold the guest’s QR steady. The scanner pauses after every result. Select Scan next guest to resume.
- **Manual:** search at least two characters of a name, email, mobile, ticket code, or a complete booking UUID. Confirm the matching guest and ticket tier before checking in. Separate tickets from one booking are admitted individually.
- **Fallback:** expand QR won’t scan to paste a signed QR link or use a keyboard/USB scanner. A plain ticket code belongs in manual search.
- **Green confirmation:** admit one guest. A sound or vibration is supplementary; the server result is authoritative.
- **Already checked in:** do not admit again. The screen shows the original entry time, event timezone and staff member.
- **Rejected:** verify the event and booking with the organizer. Cancelled/refunded/unconfirmed bookings, invalidated tickets and tickets for another event cannot enter.
- **Unconfirmed/network failure:** do not assume success or failure. Retry the same ticket; if the earlier request succeeded, the server returns a duplicate warning. Offline admission is deliberately unsupported.

Stop camera releases its stream. Hiding the tab pauses the camera; opening another page or cancelling a pending permission request also releases any late stream. Camera selection becomes available after permission if multiple cameras are detected. Flashlight controls appear only when the active camera reports torch support.

The API enforces event access, verifies signed QR data, serializes with refund/payment changes, updates valid tickets atomically, and records each result in the audit log. No database migration is required.

## Verification

```sh
pnpm exec vitest run tests/unit/checkin.test.ts tests/integration/checkin.test.ts tests/unit/ticket-qr.test.ts
PLAYWRIGHT_BASE_URL=http://localhost:3106 pnpm exec playwright test tests/e2e/checkin.spec.ts --workers=1
```

The browser suite uses a development-only component preview with intercepted API responses; it also feeds a real generated QR image into the decoder. PostgreSQL tests independently verify actual permissions, concurrent scans and cancelled/refunded admission rules. The preview is unavailable in production. Before a staffed event, check a physical phone’s camera, permissions, lighting and network connection at the venue.
