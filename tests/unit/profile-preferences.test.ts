import { describe, expect, it } from "vitest";
import { notificationPreferencesSchema } from "@/server/profile/service";

describe("account reminder preferences", () => {
  it("accepts partial boolean updates and rejects empty or unknown input", () => {
    expect(
      notificationPreferencesSchema.safeParse({
        emailRemindersEnabled: false,
      }).success,
    ).toBe(true);
    expect(
      notificationPreferencesSchema.safeParse({
        whatsappRemindersEnabled: true,
      }).success,
    ).toBe(true);
    expect(notificationPreferencesSchema.safeParse({}).success).toBe(false);
    expect(
      notificationPreferencesSchema.safeParse({
        whatsappRemindersEnabled: "yes",
      }).success,
    ).toBe(false);
    expect(
      notificationPreferencesSchema.safeParse({
        emailRemindersEnabled: true,
        role: "ADMIN",
      }).success,
    ).toBe(false);
  });
});
