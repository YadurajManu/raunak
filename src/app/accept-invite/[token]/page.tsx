import { redirect } from "next/navigation";
import { currentUser } from "@/server/auth/session";
import { AcceptButton } from "./button";

export default async function AcceptInvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  if (!(await currentUser()))
    redirect(`/login?next=${encodeURIComponent(`/accept-invite/${token}`)}`);
  return (
    <main className="market-page recovery-page">
      <p className="m-eyebrow">YOUR TEAM IS WAITING</p>
      <h1>Join this workspace</h1>
      <p>Accept the invitation to access your team&apos;s events.</p>
      <AcceptButton token={token} />
    </main>
  );
}
