import "dotenv/config";
import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it, vi } from "vitest";
import { db } from "@/server/db/client";
import {
  notificationPreferencesSchema,
  profileSchema,
  saveNotificationPreferences,
  saveProfile,
} from "@/server/profile/service";
import { lookupLocation } from "@/server/location/service";
import { postLoginPath } from "@/lib/auth-next";
const key = randomUUID();
const ids: string[] = [];
afterAll(async () => {
  await db.user.deleteMany({ where: { id: { in: ids } } });
  vi.unstubAllEnvs();
});
describe("personal onboarding", () => {
  it("normalizes phones, keeps exact location opt-in, and can remove stored details", async () => {
    const a = await db.user.create({
      data: {
        firebaseUid: `profile-${key}`,
        email: `profile-${key}@example.test`,
      },
    });
    ids.push(a.id);
    const b = await db.user.create({
      data: {
        firebaseUid: `other-profile-${key}`,
        email: `other-profile-${key}@example.test`,
      },
    });
    ids.push(b.id);
    const location = {
      city: "Pune",
      region: "Maharashtra",
      countryCode: "IN",
      label: "A precise street address",
      latitude: 18.5204,
      longitude: 73.8567,
      saveExact: false,
    };
    await saveProfile(a.id, {
      name: "Aditi Sharma",
      phone: "9876543210",
      gender: "FEMALE",
      location,
    });
    let saved = await db.user.findUniqueOrThrow({ where: { id: a.id } });
    expect(saved.phone).toBe("+919876543210");
    expect(saved.latitude).toBeNull();
    expect(saved.locationLabel).not.toContain("street");
    expect(saved.onboardingCompletedAt).toBeTruthy();
    expect(
      (await db.user.findUniqueOrThrow({ where: { id: b.id } }))
        .onboardingCompletedAt,
    ).toBeNull();
    await saveProfile(a.id, {
      name: "Aditi Sharma",
      phone: saved.phone,
      location: { ...location, saveExact: true },
    });
    saved = await db.user.findUniqueOrThrow({ where: { id: a.id } });
    expect(saved.latitude).toBe(18.5204);
    expect(saved.locationConsentAt).toBeTruthy();
    await saveProfile(a.id, {
      name: "Aditi Sharma",
      phone: saved.phone,
      gender: null,
      location: null,
    });
    saved = await db.user.findUniqueOrThrow({ where: { id: a.id } });
    expect(saved.city).toBeNull();
    expect(saved.latitude).toBeNull();
    expect(saved.locationConsentAt).toBeNull();
    expect(saved.gender).toBeNull();
  });
  it("persists reminder preferences without changing transactional ticket delivery", async () => {
    const user = await db.user.create({
      data: {
        firebaseUid: `preferences-${key}`,
        email: `preferences-${key}@example.test`,
      },
    });
    ids.push(user.id);
    expect(user.emailRemindersEnabled).toBe(true);
    expect(user.whatsappRemindersEnabled).toBe(false);
    expect(
      notificationPreferencesSchema.safeParse({
        whatsappRemindersEnabled: true,
      }).success,
    ).toBe(true);
    expect(notificationPreferencesSchema.safeParse({}).success).toBe(false);
    await saveNotificationPreferences(user.id, {
      emailRemindersEnabled: false,
      whatsappRemindersEnabled: true,
    });
    const saved = await db.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(saved.emailRemindersEnabled).toBe(false);
    expect(saved.whatsappRemindersEnabled).toBe(true);
  });
  it("rejects invalid phone, coordinate, gender and unconsented partial pins", () => {
    const base = { name: "Aditi", phone: "9876543210" };
    expect(profileSchema.safeParse({ ...base, phone: "12345" }).success).toBe(
      false,
    );
    expect(
      profileSchema.safeParse({ ...base, gender: "unknown" }).success,
    ).toBe(false);
    expect(
      profileSchema.safeParse({
        ...base,
        location: {
          city: "Pune",
          countryCode: "IN",
          latitude: 91,
          longitude: 0,
          saveExact: true,
        },
      }).success,
    ).toBe(false);
    expect(
      profileSchema.safeParse({
        ...base,
        location: { city: "Pune", countryCode: "IN", saveExact: true },
      }).success,
    ).toBe(false);
  });
  it("preserves organizer intent through mandatory personal onboarding", () => {
    expect(postLoginPath({ onboardingCompletedAt: null }, "/dashboard")).toBe(
      "/onboarding?next=%2Fdashboard",
    );
    expect(
      postLoginPath({ onboardingCompletedAt: new Date() }, "/dashboard"),
    ).toBe("/dashboard");
    expect(
      postLoginPath({ onboardingCompletedAt: new Date() }, "//evil.test"),
    ).toBe("/account");
  });
  it("maps Geoapify responses and validates before calling the provider", async () => {
    vi.stubEnv("GEOAPIFY_API_KEY", "test-only");
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        Response.json({
          results: [
            {
              formatted: "Pune, Maharashtra, India",
              lat: 18.5204,
              lon: 73.8567,
              city: "Pune",
              state: "Maharashtra",
              country_code: "in",
            },
          ],
        }),
      );
    const results = await lookupLocation(
      randomUUID(),
      { kind: "reverse", latitude: 18.5204, longitude: 73.8567 },
      request,
    );
    expect(results[0].countryCode).toBe("IN");
    expect(results[0].city).toBe("Pune");
    expect(new URL(String(request.mock.calls[0][0])).pathname).toBe(
      "/v1/geocode/reverse",
    );
    await expect(
      lookupLocation(
        randomUUID(),
        { kind: "reverse", latitude: 999, longitude: 0 },
        request,
      ),
    ).rejects.toThrow();
    expect(request).toHaveBeenCalledTimes(1);
  });
});
