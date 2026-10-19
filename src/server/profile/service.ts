import { z } from "zod";
import { parsePhoneNumberFromString } from "libphonenumber-js/max";
import { db } from "@/server/db/client";

export const locationSchema = z
  .object({
    city: z.string().trim().min(1).max(120),
    region: z.string().trim().max(120).default(""),
    countryCode: z.string().regex(/^[A-Z]{2}$/),
    label: z.string().trim().max(500).default(""),
    latitude: z.number().finite().min(-90).max(90).optional(),
    longitude: z.number().finite().min(-180).max(180).optional(),
    saveExact: z.boolean().default(false),
  })
  .refine(
    (value) =>
      !value.saveExact ||
      (value.latitude !== undefined && value.longitude !== undefined),
    "Choose a pin before saving precise location.",
  );
export const profileSchema = z.object({
  name: z.string().trim().min(2).max(100),
  phone: z
    .string()
    .trim()
    .max(30)
    .transform((value, context) => {
      const phone = parsePhoneNumberFromString(value, {
        defaultCountry: "IN",
        extract: false,
      });
      if (!phone?.isValid() || phone.ext) {
        context.addIssue({
          code: "custom",
          message:
            "Enter a valid phone number, including country code outside India.",
        });
        return z.NEVER;
      }
      return phone.number;
    }),
  gender: z
    .enum(["FEMALE", "MALE", "NON_BINARY", "OTHER", "PREFER_NOT_TO_SAY"])
    .nullable()
    .default(null),
  location: locationSchema.nullable().default(null),
});
export const notificationPreferencesSchema = z
  .object({
    emailRemindersEnabled: z.boolean().optional(),
    whatsappRemindersEnabled: z.boolean().optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0);

export async function saveNotificationPreferences(userId: string, input: unknown) {
  z.uuid().parse(userId);
  const data = notificationPreferencesSchema.parse(input);
  return db.user.update({
    where: { id: userId },
    data,
    select: {
      emailRemindersEnabled: true,
      whatsappRemindersEnabled: true,
    },
  });
}

export async function saveProfile(userId: string, input: unknown) {
  z.uuid().parse(userId);
  const data = profileSchema.parse(input);
  const current = await db.user.findUniqueOrThrow({ where: { id: userId } });
  const location = data.location;
  return db.user.update({
    where: { id: userId },
    data: {
      name: data.name,
      phone: data.phone,
      gender: data.gender,
      city: location?.city || null,
      region: location?.region || null,
      countryCode: location?.countryCode || null,
      locationLabel: location
        ? location.saveExact
          ? location.label
          : [location.city, location.region, location.countryCode]
              .filter(Boolean)
              .join(", ")
        : null,
      latitude: location?.saveExact ? location.latitude : null,
      longitude: location?.saveExact ? location.longitude : null,
      locationConsentAt: location?.saveExact ? new Date() : null,
      onboardingCompletedAt: current.onboardingCompletedAt || new Date(),
    },
    select: { id: true, onboardingCompletedAt: true },
  });
}
