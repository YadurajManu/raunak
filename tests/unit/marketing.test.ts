import { describe, expect, it } from "vitest";
import { faqSchema, marketing } from "@/config/marketing";
import {
  firstEventLabel,
  pricing,
  rupees,
  standardFeeLabel,
} from "@/config/pricing";

describe("marketing price copy", () => {
  it("formats INR from the single pricing config", () => {
    expect(rupees(300)).toBe("₹3");
    expect(rupees(350)).toBe("₹3.50");
    expect(firstEventLabel()).toContain(
      rupees(pricing.firstEvent.platformFeePaise),
    );
    expect(standardFeeLabel()).toContain(`${pricing.standard.percent}%`);
    expect(standardFeeLabel()).toContain(rupees(pricing.standard.fixedPaise));
  });
  it("generates FAQ structured data from visible FAQ copy", () => {
    const schema = faqSchema();
    expect(schema.mainEntity).toHaveLength(marketing.faq.length);
    expect(schema.mainEntity[0].acceptedAnswer.text).toBe(
      marketing.faq[0].answer,
    );
    expect(marketing.faq[0].answer).toContain(standardFeeLabel());
  });
});

import { authNextPath } from "@/lib/auth-next";
it("keeps account redirects inside known app routes", () => {
  expect(authNextPath("/my-tickets")).toBe("/my-tickets");
  expect(authNextPath("//evil.test")).toBe("/dashboard");
  expect(authNextPath("https://evil.test")).toBe("/dashboard");
});
