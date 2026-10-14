import { redirect } from "next/navigation";
import { currentUser } from "@/server/auth/session";
import { OnboardingForm } from "./form";

export default async function OnboardingPage() {
  if (!await currentUser()) redirect("/login");
  return <OnboardingForm />;
}
