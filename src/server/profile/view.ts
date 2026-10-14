import type { User } from "@/generated/prisma/client";
import type { ProfileValues } from "@/components/onboarding/profile-form";
export function profileValues(user: User): ProfileValues {
  return {
    name: user.name || "",
    phone: user.phone || "",
    gender: user.gender,
    location:
      user.city && user.countryCode
        ? {
            city: user.city,
            region: user.region || "",
            countryCode: user.countryCode,
            label: user.locationLabel || user.city,
            latitude: user.latitude ?? undefined,
            longitude: user.longitude ?? undefined,
            saveExact: Boolean(user.locationConsentAt),
          }
        : null,
  };
}
