export const pricing = {
  firstEvent: { platformFeePaise: 0 },
  standard: { percent: 2, fixedPaise: 300 },
} as const;
// Confirm commercial pricing and implement first-event eligibility in checkout before launch.

export function rupees(paise: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: paise % 100 ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(paise / 100);
}
export function standardFeeLabel() {
  return `${pricing.standard.percent}% + ${rupees(pricing.standard.fixedPaise)} per paid ticket`;
}
export function firstEventLabel() {
  return `Your first event — ${rupees(pricing.firstEvent.platformFeePaise)} platform fee`;
}
