import type { Metadata } from "next";
import { APP_NAME } from "@/lib/constants";
import { redirect } from "next/navigation";
import { currentUser } from "@/server/auth/session";
import { postLoginPath } from "@/lib/auth-next";
import { authNextPath } from "@/lib/auth-next";
import { AuthForm } from "@/components/auth/auth-form";
import { RouteFooter } from "@/components/marketing/footer";
export default async function LoginPage({
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
    <>
    <AuthForm
      mode="login"
      initialEmail={email}
      nextPath={authNextPath(
        next || (intent === "organizer" ? "/dashboard" : undefined),
      )}
    />
    <RouteFooter pathname="/login" />
    </>
  );
}

export const metadata: Metadata = {
  title: `Sign in | ${APP_NAME}`,
  robots: { index: false, follow: false },
};
