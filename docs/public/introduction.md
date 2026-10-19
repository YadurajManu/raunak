# Welcome to Raunak

Discover events. Sell tickets. Scan guests in. Raunak brings event discovery, organizer tools, ticket bookings and QR check-in into one India-first platform.

College fests, workshops, community meetups and comedy nights are examples of the kinds of plans an organizer can create. They are not claims about customers or events currently using the platform.

## Find your next plan

Attendees can browse public events, search by event, venue or organizer, choose a city, narrow dates and prices, and save events to their account. Open an event for its schedule, venue, media, organizer and available ticket types.

Booking requires sign-in. Free bookings are confirmed without a payment gateway; paid bookings use Cashfree hosted checkout when its provider account is configured. Confirmed admission tickets appear in the attendee wallet. Each ticket has its own signed admission QR, and a background worker prepares downloadable PDFs and permitted notifications.

[Follow the attendee journey](attendees.md).

## Bring people together

Organizers work inside separate workspaces. They create an event, upload artwork, set ticket prices and inventory, add venue or joining details, and submit it for platform review. Approval makes the event eligible for publication; only public published events enter discovery.

At the door, authorized staff scan admission QR codes or find a guest manually. The server checks the event, booking and ticket before recording entry, and warns when a ticket has already been used.

[Follow the organizer workflow](organizers.md).

## What is included

| Area | Available behavior |
| --- | --- |
| Discovery | Server-backed filters, suggestions, cities, optional nearby search, saved events and organizer profiles |
| Hosting | Workspaces, roles, event editing, media, ticket inventory and platform publication review |
| Booking | Account-owned free and paid orders, inventory holds and idempotent payment processing |
| Ticket wallet | Admission QR, ticket status, private PDF downloads, calendar export and permitted resends |
| Event operations | QR/manual entry, duplicate warnings, attendee search, exports and cancellation/refund operations |
| Attendee feedback | Post-event reviews tied to eligible bookings, with optional practical tips |

## Start locally

The documentation is public and can be read without an account or active provider connections. Running the complete application requires local services and Firebase configuration for authenticated journeys. Paid checkout, geocoding and outbound delivery have additional provider requirements.

[Install Raunak](installation.md), then read [architecture](architecture.md) and [integration requirements](integrations.md).

> [!IMPORTANT]
> Implemented integrations are not a promise of live provider activation, merchant settlement, message delivery or real-device camera acceptance. Use the verification guidance before running an event.

## Project links

- [Open Raunak](https://raunak.yaduraj.me)
- [Source on GitHub](https://github.com/YadurajManu/raunak)
- [Contribute](contributing.md)

Raunak is the public name. Some internal package and development database identifiers retain the earlier working codename, Eventra.
