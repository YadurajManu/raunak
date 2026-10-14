import { redirect } from "next/navigation";
import { currentUser } from "@/server/auth/session";
import { ProfileSettings } from "@/components/onboarding/profile-settings";
import { AccountShell } from "@/components/onboarding/account-shell";
import { profileValues } from "@/server/profile/view";
export default async function ProfilePage() {
  const user = await currentUser();
  if (!user) redirect("/login?next=/account/profile");
  return (
    <AccountShell
      name={user.name || "You"}
      email={user.email}
      avatarUrl={user.avatarKey}
      active="Profile"
    >
      <ProfileSettings
        initial={profileValues(user)}
        email={user.email}
        avatarKey={user.avatarKey}
      />
    </AccountShell>
  );
}
