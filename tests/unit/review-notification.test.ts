import { describe, expect, it } from "vitest";
import { createReviewRequestEmail } from "@/server/admin/review-notification";

describe("event review notification", () => {
  it("includes event details and links directly to the selected admin review", () => {
    const email = createReviewRequestEmail(
      {
        id: "0f52de75-5e2a-4a94-b7c6-bb7dab631457",
        title: "Garba Night",
        category: "Community",
        mode: "IN_PERSON",
        startsAt: new Date("2026-10-24T12:00:00.000Z"),
        timezone: "Asia/Kolkata",
        venueName: "ICT Lawn",
        address: "Mamnathal Road",
        city: "Ahmedabad",
        orgName: "Raunak Events",
        submittedAt: new Date("2026-10-19T12:00:00.000Z"),
      },
      "https://raunak.yaduraj.me",
    );

    expect(email.to).toBe("yadurajsingham@gmail.com");
    expect(email.text).toContain("Garba Night");
    expect(email.text).toContain("ICT Lawn, Mamnathal Road, Ahmedabad");
    expect(email.text).toContain(
      "https://raunak.yaduraj.me/admin?event=0f52de75-5e2a-4a94-b7c6-bb7dab631457",
    );
  });

  it("escapes organizer-controlled content in the HTML email", () => {
    const email = createReviewRequestEmail(
      {
        id: "0f52de75-5e2a-4a94-b7c6-bb7dab631457",
        title: "<script>alert(1)</script>",
        category: null,
        mode: "ONLINE",
        startsAt: new Date("2026-10-24T12:00:00.000Z"),
        timezone: "Asia/Kolkata",
        venueName: null,
        address: null,
        city: null,
        orgName: "<img src=x>",
        submittedAt: new Date("2026-10-19T12:00:00.000Z"),
      },
      "https://raunak.yaduraj.me",
    );

    expect(email.html).not.toContain("<script>");
    expect(email.html).toContain("&lt;script&gt;");
    expect(email.html).toContain("&lt;img src=x&gt;");
    expect(email.html).toContain("Online event");
  });
});
