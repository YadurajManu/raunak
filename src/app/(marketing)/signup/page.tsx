import type { Metadata } from "next";
import { APP_NAME } from "@/lib/constants";
import { authNextPath } from "@/lib/auth-next";
import { AuthForm } from "@/components/auth/auth-form";
export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  return <AuthForm mode="signup" nextPath={authNextPath(next)} />;
}

export const metadata: Metadata = { title: `Create your account | ${APP_NAME}`, robots: { index: false, follow: false } };
