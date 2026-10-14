import { redirect } from "next/navigation";
import { currentUser } from "@/server/auth/session";
import { ProfileForm } from "@/components/onboarding/profile-form";
import { profileValues } from "@/server/profile/view";
export default async function ProfilePage() {
  const user = await currentUser();
  if (!user) redirect("/login?next=/account/profile");
  return <ProfileForm initial={profileValues(user)} next="/account" editing />;
}
