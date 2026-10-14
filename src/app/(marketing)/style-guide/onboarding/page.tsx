import { notFound } from "next/navigation";
import { ProfileForm } from "@/components/onboarding/profile-form";
export default function ProfilePreview() {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <ProfileForm
      initial={{ name: "", phone: "", gender: null, location: null }}
    />
  );
}
