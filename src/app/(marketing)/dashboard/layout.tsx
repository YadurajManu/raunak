import { AccountShell } from "@/components/onboarding/account-shell";
import { redirect } from "next/navigation";
import { currentUser } from "@/server/auth/session";
export default async function OrganizerGuard({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await currentUser();
  if (!user) redirect("/login?intent=organizer");
  if (!user.onboardingCompletedAt) redirect("/onboarding?next=/dashboard");
  return (
    <AccountShell
      name={user.name || "You"}
      email={user.email}
      avatarUrl={user.avatarKey}
      organizer
    >
      <div className="r-organizer">{children}</div>
    </AccountShell>
  );
}
