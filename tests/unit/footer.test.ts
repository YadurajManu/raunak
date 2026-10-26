import { describe, expect, it } from "vitest";
import { footerVariantForPath } from "../../src/config/footer";

describe("footer route variants", () => {
  it("uses the full footer on public, account, and legal pages", () => {
    for (const path of ["/", "/discover", "/e/an-event", "/organizers/manu", "/account", "/account/profile", "/my-tickets", "/orders/order-id", "/help", "/refunds", "/contact", "/privacy", "/terms"]) {
      expect(footerVariantForPath(path), path).toBe("full");
    }
  });

  it("keeps checkout, sign-in, onboarding, and ticket links minimal", () => {
    for (const path of ["/login", "/signup", "/onboarding", "/accept-invite/token", "/organizer/setup", "/checkout-preview", "/checkout/event", "/t/token"]) {
      expect(footerVariantForPath(path), path).toBe("minimal");
    }
  });

  it("omits the footer on organizer and scanner tools and unknown routes", () => {
    for (const path of ["/dashboard", "/dashboard/events", "/admin", "/checkin", "/not-a-page"]) {
      expect(footerVariantForPath(path), path).toBe("none");
    }
  });
});
