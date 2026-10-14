# Remaining MVP execution

User authorized completion of the remaining MVP flows on 14 October 2026.
Preserve the Raunak paper/ink/vermilion design and the immediate-signup behavior.

- [x] M6 implementation (sandbox activation pending credentials): concurrency-safe checkout, Cashfree verification, hold expiry, late refunds, free tickets.
- [ ] M7: signed QR tickets, private PDF downloads, ticket wallet and resend.
- [ ] M8: durable notifications, provider sending, customizable templates, reminders and delivery logs.
- [ ] M9: role-restricted camera/manual check-in, duplicate protection and history.
- [ ] M10: branded organizer dashboards, reports/exports, rate limits, headers, backups and golden path.

External activation requires Cashfree sandbox credentials, verified email sending,
Meta sender credentials/approved templates, and a Geoapify key. Tests use injected
payment mocks and local SMTP; production must never substitute mock payments.
