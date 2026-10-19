import { notFound, redirect } from "next/navigation";
import { currentPlatformAdmin, currentUser } from "@/server/auth/session";
import { listReviewEvents } from "@/server/admin/reviews";
import { ReviewConsole } from "@/components/admin/review-console";
import "./admin.css";

export default async function AdminReviewPage() {
  const admin = await currentPlatformAdmin();
  if (!admin) {
    if (!(await currentUser())) redirect("/login?next=%2Fadmin");
    notFound();
  }
  const events = await listReviewEvents("PENDING_REVIEW");
  return <ReviewConsole initialEvents={events} />;
}
