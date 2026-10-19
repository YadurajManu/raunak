import { notFound, redirect } from "next/navigation";
import { currentPlatformAdmin, currentUser } from "@/server/auth/session";
import { listReviewEvents } from "@/server/admin/reviews";
import { ReviewConsole } from "@/components/admin/review-console";
import "./admin.css";

export default async function AdminReviewPage({
  searchParams,
}: {
  searchParams: Promise<{ event?: string | string[] }>;
}) {
  const query = await searchParams;
  const requestedId = Array.isArray(query.event) ? query.event[0] : query.event;
  const next = `/admin${requestedId ? `?event=${encodeURIComponent(requestedId)}` : ""}`;
  const admin = await currentPlatformAdmin();
  if (!admin) {
    if (!(await currentUser()))
      redirect(`/login?next=${encodeURIComponent(next)}`);
    notFound();
  }
  const events = await listReviewEvents("PENDING_REVIEW");
  return (
    <ReviewConsole initialEvents={events} initialSelectedId={requestedId} />
  );
}
