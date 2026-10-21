"use client";

import { ProfileEditor } from "./profile-editor";

export function ProfileEditorFixture({
  readOnly = false,
}: {
  readOnly?: boolean;
}) {
  return (
    <ProfileEditor
      readOnly={readOnly}
      orgId="sample-org"
      orgSlug="sample-collective"
      orgName="Sample Collective"
      initial={{
        tagline: "Good people, memorable evenings.",
        bio: "A local community bringing people together through music, culture and good conversation.",
        socialLinks: { website: "https://example.com" },
        supportEmail: "hello@example.com",
        supportPhone: "",
        profileVisible: true,
      }}
    />
  );
}
