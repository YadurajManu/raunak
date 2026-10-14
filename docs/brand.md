# Raunak UI foundation

Raunak means the warmth, life, and energy people bring to a place. The identity pairs the feeling of a printed ticket with a calm interface.

The brand name lives in `src/lib/constants.ts`. Landing and account pages share `src/app/(marketing)/layout.tsx`, fonts, theme and scoped styles. Reuse this foundation when redesigning the organizer dashboard; avoid introducing a second palette.

## Color

| Role | Light | Dark |
|---|---|---|
| Paper | `#F5F0E6` | `#0F0E0C` |
| Surface | `#EDE6D8` | `#191714` |
| Ink | `#14120F` | `#F5F0E6` |
| Muted text | `#6F695F` | `#A9A294` |
| Vermilion | `#FF4B2B` | `#FF5A3C` |
| Accessible accent text | `#AA301B` | `#FF8D76` |
| Sticker yellow | `#FFC53D` | `#FFC53D` |
| Success | `#1F8A5B` | `#3CCB8A` |

The green `#244D3B` supports WhatsApp previews, the footer and account artwork. Use vermilion for primary actions, yellow for occasional stickers, and success green for actual positive states. Small accent text uses the accessible accent text token.

## Type and shape

- Geist: interface, body, headings and forms.
- Instrument Serif: warm emphasis and editorial moments. Use italic sparingly.
- Geist Mono: ticket metadata, labels, timestamps and microcopy.
- Use an 8px spacing rhythm, 20–28px cards, 9–12px controls, thin ink borders and short hard offset shadows.
- Decorative QR patterns are fictional and must remain `aria-hidden`. Real ticket QR codes belong to the ticket service.

## Motion and interaction

Use meaningful movement: ticket physics, sequence progress, state confirmation. Motion runs for 0.5–0.9 seconds with `cubic-bezier(0.22, 1, 0.36, 1)`. Mobile uses stacked content. Reduced motion disables smooth scroll, pinning, parallax, loops and confetti. Keyboard focus stays visible.

Reusable motifs live in `src/components/marketing/motifs.tsx`; interaction utilities live in `src/lib/motion/`. `/style-guide` is available during development and returns 404 in production.

## Copy and pricing

Marketing copy, navigation, FAQ and footer links live in `src/config/marketing.ts`. Commercial pricing lives in `src/config/pricing.ts`. Defaults: first-event platform fee ₹0; subsequent paid tickets 2% + ₹3; gateway charges separate. These are proposed prices and need owner confirmation and backend eligibility logic before launch.

Demo event content is fictional. Analytics explicitly says sample data. No testimonials, customer logos, user counts or ratings are invented.
