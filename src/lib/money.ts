export function parseInrToPaise(value: string): number {
  if (!/^\d+(?:\.\d{1,2})?$/.test(value))
    throw new Error("Enter a valid INR amount.");
  const [rupees, paise = ""] = value.split(".");
  const amount =
    BigInt(rupees) * BigInt(100) + BigInt((paise + "00").slice(0, 2));
  if (amount > BigInt(Number.MAX_SAFE_INTEGER))
    throw new Error("Amount is too large.");
  return Number(amount);
}

export function formatInr(paise: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
  }).format(paise / 100);
}
