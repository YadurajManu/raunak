# Garba partner app: product and implementation plan

## Goal

Help verified students attending one college Garba event find a compatible dance partner. The Android client is built with Flutter. A match is a mutual like; users can chat after matching and mark when they have found a partner.

## Release boundary

The app is for adults (18+) if distributed through Google Play. Google Play requires matchmaking apps to restrict minor access. Confirm the college, allowed email domains, event identity, and distribution route before opening registration. A college email proves mailbox access, not age or event attendance.

## First release

1. **Access:** email and password sign-in, email verification, approved college domain, age eligibility, event participation confirmation, private email address.
2. **Profile:** name or display name, photos, short introduction, hobbies, Garba experience, dance style, availability, partner preferences, and visibility toggle. Video and voice introduction are optional enhancements after the core flow works.
3. **Discovery:** show eligible and visible attendees with compatible preferences. Let users pass or like. Do not expose who liked a user until interest is mutual. Avoid popularity scores and unlimited unsolicited messages.
4. **Match:** create a match exactly once when two eligible users like each other. Either person can unmatch. A user can keep several matches and set a “partner found” status that removes them from discovery.
5. **Chat:** one-to-one messages after matching, with photo sharing, delivery state, notifications, and block/report controls. No phone number is collected or displayed.
6. **Safety and privacy:** report a profile, match, or message; block an account; moderate public profiles and uploaded media; delete account and media; limit upload size/type and message abuse. Explain what a reporter chooses to share with moderators.
7. **Event outcome:** show the event time/place, allow a matched pair to mutually confirm partnership, and let either person cancel it. Encourage first meetings at the public event venue.

## Later, if the first release needs them

- Short video and voice introductions, voice messages, richer filters, icebreaker prompts, and accessibility improvements informed by testing.
- Event-specific matching for additional events. Do not generalize the data model or navigation until a second event is planned.

## Privacy and encryption decision

Profile content must be readable by eligible attendees and subject to moderation. Chat content and attachments can be end-to-end encrypted, but that requires established client-side key management, device recovery, attachment encryption, and a reporting flow in which the reporter explicitly shares evidence. Do not label a chat “end-to-end encrypted” until those properties are implemented and tested. Server-side encryption alone is not end-to-end encryption.

## Fit with this repository

The existing Next.js app provides events, Firebase authentication, PostgreSQL/Prisma, and media storage. Reuse the event identity and authentication infrastructure where appropriate. Keep matchmaking data and access checks separate from general event discovery. Before adding Next.js routes, read the relevant local `node_modules/next/dist/docs/` guides as required by `AGENTS.md`.

Proposed delivery order:

1. Confirm eligibility, college domain, event identifier, and release channel.
2. Define the data model and API contract for profiles, likes, matches, blocks, and partnership status.
3. Build the Flutter Android shell and sign-in/profile/discovery/match screens against a local mock.
4. Add authenticated APIs, persistence, and media controls; connect the Flutter client.
5. Add chat and its verified encryption design, then notifications and reporting.
6. Test the complete two-account flow on Android devices and run a limited college pilot.

## Acceptance checks

- An ineligible or unverified account cannot browse or be shown.
- A one-sided like never opens chat; a mutual like creates one match.
- Blocking or unmatching stops chat and hides the accounts from each other.
- A person marked “partner found” is excluded from discovery and can reverse that choice.
- Deleting an account removes its public profile and uploaded media according to the stated retention policy.
- A user can report abuse without giving organizers routine access to private chats.

## Open decisions

- Exact college name and approved email domain(s).
- Event ID and whether registration requires a ticket or organizer invitation.
- Google Play release or private campus distribution.
- Whether the first release must ship with fully end-to-end encrypted chat, or whether chat waits until the encryption and reporting design is ready.
