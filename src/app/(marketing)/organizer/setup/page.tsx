import { redirect } from "next/navigation";
import { currentUser } from "@/server/auth/session";
import { OnboardingForm } from "./form";
export default async function OrganizerSetup() {
  const user = await currentUser();
  if (!user) redirect("/login?intent=organizer");
  if (!user.onboardingCompletedAt)
    redirect("/onboarding?next=/organizer/setup");
  return <OnboardingForm />;
}
