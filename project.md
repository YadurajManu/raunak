# Eventra — Project Brief

> Working name: **Eventra** (codename only). Keep the name in one config constant `APP_NAME` so renaming is a one-line change.

## 1. Vision

A multi-tenant event-management SaaS. Organizers create events, sell tickets, manage their team and check people in at the gate. Attendees discover an event, pay the entry fee, and instantly receive a **QR-code ticket by email and WhatsApp**. Everything is run from one clean, minimal dashboard.

India-first: INR, Cashfree payments, WhatsApp-first communication, IST by default, mobile-first UI.

## 2. Target customers

College fests and clubs, workshop and bootcamp organizers, community meetups, comedy/music nights, hackathons, small conferences. Typical event size: 50–5,000 attendees.

## 3. Actors and roles

| Actor | Scope | Can do |
|---|---|---|
| Super Admin | Platform | Manage organizations, platform fee, suspend accounts, view everything |
| Owner | Organization | Everything in the org, including payout/billing settings and deleting the org |
| Admin | Organization | Everything except billing/payout and org deletion; manage team |
| Event Manager | Assigned events | Create/edit assigned events, view orders and attendees, edit messages |
| Check-in Staff | Assigned events | Scanner and attendee list only |
| Finance | Organization | Read-only orders, payments, payouts, exports |
| Attendee | Own data | Browse, buy, view own tickets |

**Assignees:** any org member can be assigned to one or more events (`EventStaff`). Event Managers and Check-in Staff only see events they are assigned to. Owner/Admin see all events. Phase 2 extends assignees to event tasks (multiple assignees per task).

## 4. Core journeys

**Organizer:** sign up → create workspace → create event (poster, gallery, lineup, ticket types) → publish → share link → watch sales → customize WhatsApp/email messages → check in guests at the gate → export reports.

**Attendee:** open event link → choose tickets → sign in (inline, no page change) → pay with Cashfree → receive QR ticket by email + WhatsApp → find it again under "My tickets".

**Gate staff:** open scanner on phone → scan QR → big green "Valid" or red "Already used / Invalid".

## 5. Feature scope

### Phase 1 — MVP (build now)

**A. Auth and accounts**
- Firebase Auth: email/password, Google sign-in, email verification, password reset.
- Server-verified session cookie; user row mirrored in PostgreSQL.

**B. Workspaces and team**
- Create organization (workspace) on first organizer onboarding; org profile (logo, support email/phone, brand colour).
- Invite members by email with a role; accept invite; change role; remove member.
- Assign members to events (assignees).

**C. Events**
- CRUD with draft/published/cancelled/ended states, slug URLs, in-person/online/hybrid, venue, map link, timezone, capacity, refund policy text, rich description.
- Lineup/People section: speakers, guests, performers, team members, each with photo, title, bio.
- Duplicate event.

**D. Media**
- Upload many images per event: poster, cover, gallery, and people photos. Reorder, set alt text, delete.
- Accept JPG, PNG, WebP, AVIF, GIF, HEIC/HEIF; auto-generate optimized variants (thumb, card, hero, OG 1200×630) with blur placeholders.
- S3-compatible storage with presigned direct uploads.

**E. Ticketing**
- Multiple ticket types per event (free or paid), price, quantity, sale window, min/max per order, hidden types.
- Inventory is never oversold (atomic holds with expiry).

**F. Checkout and payments**
- Cashfree Payment Gateway (sandbox + production), UPI/cards/netbanking/wallets via Cashfree checkout.
- Server-side order creation, signature-verified webhooks, idempotent processing, failed/expired handling, platform fee line item.
- Free tickets skip payment.

**G. Ticket delivery**
- Signed QR per ticket, PDF ticket, email with ticket(s) attached, ticket page `/t/[token]`, "My tickets" wallet, resend ticket button.

**H. Notifications and WhatsApp automations**
- Triggers: order confirmed, ticket issued, payment failed, reminder 24h, reminder 2h, event updated, event cancelled.
- Channels: email and WhatsApp. Enable/disable per trigger per channel.
- Message editor in the dashboard with variables (`{{attendee_name}}`, `{{event_title}}` …), live preview, "send test to me".
- Delivery log with status, retries and error reasons.

**I. Check-in**
- Phone-friendly scanner (camera), manual search by name/email/phone/code, check-in history, double-scan protection.

**J. Dashboards**
- Organizer overview: revenue, tickets sold, check-in rate, sales over time, recent orders.
- Event dashboard tabs: Overview, Details, Media, Tickets, Attendees, Orders, Messages, Team, Check-in, Settings.
- Attendee dashboard: My tickets, order history.
- CSV export of attendees and orders.

**K. Platform basics**
- Landing page, public discover page, SEO and Open Graph tags per event, audit log, rate limiting, error tracking hooks, seed data.

### Phase 2

Coupons/promo codes, dashboard refunds, organizer payouts (Cashfree Easy Split / Payouts), event tasks with multiple assignees (kanban), custom registration questions, waitlist, per-organization WhatsApp number connection and Meta template submission from the dashboard, analytics v2, guest checkout, ticket transfer, `.ics` calendar invite, user data export/delete.

### Phase 3

Recurring events, seat maps, embeddable ticket widget, public API + outbound webhooks, offline-capable check-in PWA, multi-language, broadcast campaigns, affiliate links.

## 6. Non-goals (for now)

Native mobile apps, reserved seating, multi-currency, ticket resale marketplace, live-streaming features.

## 7. UX principles

- **Minimal and calm:** generous whitespace, neutral greys, one accent colour, light and dark themes, a single clean sans-serif font.
- **Mobile-first public pages.** Checkout in at most 3 steps and under 60 seconds.
- **Dashboard:** left sidebar, top bar with org switcher, consistent data tables (search, filters, pagination), skeleton loaders, helpful empty states, inline validation, toasts, no modal inside a modal.
- **Accessible:** WCAG AA contrast, keyboard navigation, visible focus rings, labels on all inputs.
- **Fast:** LCP under 2.5s on 4G, responsive images (AVIF/WebP) with blur placeholders.

## 8. MVP acceptance — the golden path

1. Organizer signs up and creates workspace "Acme Club".
2. Creates an event with a poster, 3 gallery photos, 2 lineup people with photos, and 2 ticket types (General ₹499, VIP ₹999).
3. Invites a teammate as Check-in Staff and assigns them to the event.
4. Publishes; the public URL renders a correct social preview (OG image).
5. An attendee signs in and buys 2 General tickets through Cashfree sandbox.
6. The webhook marks the order PAID, 2 tickets are issued, and the email (with QR/PDF) and WhatsApp message are delivered.
7. The attendee sees both tickets under "My tickets".
8. Staff scans a QR: "Valid ✓". Scanning again: "Already used at 18:42 by Rohan".
9. Organizer dashboard shows revenue, tickets sold, check-ins; CSV export works.
10. Organizer edits the "Ticket issued" WhatsApp message in the dashboard; the next purchase uses the new text.

## 9. Decisions made (change any you disagree with)

| Topic | Default |
|---|---|
| Auth methods | Firebase email/password + Google. Login required to buy (inline in checkout); guest checkout is Phase 2 |
| WhatsApp | Provider interface. Production: Meta WhatsApp Cloud API. Dev/low-volume only: optional unofficial whatsapp-web.js worker (account-ban risk, against WhatsApp ToS, never the default for customers) |
| WhatsApp customization (MVP) | Organizers edit customizable slots and enable/disable triggers on pre-approved templates. Full custom template submission is Phase 2 |
| Payouts | Phase 1 collects money into the platform's Cashfree account and records everything needed for payouts. Automated split/payout is Phase 2 |
| Platform fee | Configurable % + fixed fee per ticket, organizer chooses "absorb" or "pass to buyer" |
| Tax | Store tax fields, but do not hard-code GST logic; confirm with an accountant before launch |
| Currency / timezone | INR only; store UTC, display in event timezone (default Asia/Kolkata) |