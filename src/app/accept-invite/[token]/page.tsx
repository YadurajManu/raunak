import { redirect } from "next/navigation";
import { currentUser } from "@/server/auth/session";
import { AcceptButton } from "./button";

export default async function AcceptInvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!await currentUser()) redirect(`/login?next=${encodeURIComponent(`/accept-invite/${token}`)}`);
  return <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-6"><h1 className="text-3xl font-semibold">Join this workspace</h1><p className="mt-3 text-zinc-600 dark:text-zinc-400">Accept the invitation to access your team&apos;s events.</p><AcceptButton token={token} /></main>;
}
