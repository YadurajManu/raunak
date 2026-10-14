import type { Metadata } from "next";
import { APP_NAME } from "@/lib/constants";
import { redirect } from "next/navigation";
import { currentUser } from "@/server/auth/session";
import { postLoginPath } from "@/lib/auth-next";
import { authNextPath } from "@/lib/auth-next";
import { AuthForm } from "@/components/auth/auth-form";
export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; intent?: string; email?: string }>;
}) {
  const { next, intent, email } = await searchParams;
  const user = await currentUser();
  if (user)
    redirect(
      postLoginPath(
        user,
        next || (intent === "organizer" ? "/dashboard" : undefined),
      ),
    );
  return (
    <AuthForm
      mode="signup"
      initialEmail={email}
      nextPath={authNextPath(
        next || (intent === "organizer" ? "/dashboard" : undefined),
      )}
    />
  );
}

export const metadata: Metadata = {
  title: `Create your account | ${APP_NAME}`,
  robots: { index: false, follow: false },
};
