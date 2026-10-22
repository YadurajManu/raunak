import { notFound } from "next/navigation";
import { ProfileSettings } from "@/components/onboarding/profile-settings";
import { AccountShell } from "@/components/onboarding/account-shell";

export default function PersonalSettingsPreview() {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <>
      <p className="personal-fixture-label">
        SAMPLE ACCOUNT · COMPONENT PREVIEW
      </p>
      <AccountShell>
        <ProfileSettings
          initial={{
            name: "Aditi Sharma",
            phone: "+919876543210",
            gender: null,
            location: {
              city: "Pune",
              region: "Maharashtra",
              countryCode: "IN",
              label: "Pune, Maharashtra, India",
              saveExact: false,
            },
          }}
          email="aditi@example.test"
          avatarKey={null}
        />
      </AccountShell>
    </>
  );
}
