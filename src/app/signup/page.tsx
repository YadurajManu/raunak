import { AuthForm } from "@/components/auth/auth-form";
export default async function SignupPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return <AuthForm mode="signup" nextPath={next && /^\/accept-invite\/[A-Za-z0-9_-]{20,100}$/.test(next) ? next : "/dashboard"} />;
}
