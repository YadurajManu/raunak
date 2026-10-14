import { redirect } from "next/navigation";
import { currentUser } from "@/server/auth/session";
import { ProfileForm } from "@/components/onboarding/profile-form";
import { profileValues } from "@/server/profile/view";
import { authNextPath } from "@/lib/auth-next";
import { APP_NAME } from "@/lib/constants";
export const metadata = {
  title: `Welcome to ${APP_NAME}`,
  robots: { index: false, follow: false },
};
export default async function Onboarding({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const next = authNextPath((await searchParams).next);
  const user = await currentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(next)}`);
  if (user.onboardingCompletedAt) redirect(next);
  return <ProfileForm initial={profileValues(user)} next={next} />;
}
