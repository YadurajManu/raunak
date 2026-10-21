import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { NavigationLink } from "@/components/navigation-link";
import { redirect } from "next/navigation";
import { currentUser } from "@/server/auth/session";
import { requireEventAccessForUser } from "@/server/rbac/access";
import { db } from "@/server/db/client";

export default async function EventLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const user = await currentUser();
  if (!user) redirect("/login");
  const { id } = await params;
  let access;
  try {
    access = await requireEventAccessForUser(user.id, id, [
      "OWNER",
      "ADMIN",
      "MANAGER",
      "CHECKIN",
      "FINANCE",
    ]);
  } catch {
    redirect("/dashboard");
  }
  const event = await db.event.findUniqueOrThrow({
    where: { id },
    select: { title: true, orgId: true },
  });
  const member = await db.organizationMember.findUniqueOrThrow({
    where: { orgId_userId: { orgId: access.orgId, userId: user.id } },
  });
  const tabs =
    member.role === "FINANCE"
      ? [
          ["Overview", ""],
          ["Attendees", "/attendees"],
        ]
      : member.role === "CHECKIN"
        ? [
            ["Check-in", "/check-in"],
            ["Attendees", "/attendees"],
          ]
        : [
            ["Overview", ""],
            ["Details", "/details"],
            ["Media", "/media"],
            ["Tickets", "/tickets"],
            ["Attendees", "/attendees"],
            ["Check-in", "/check-in"],
            ["Messages", "/messages"],
            ["Team", "/team"],
            ["Settings", "/settings"],
          ];
  return (
    <div className="r-event-workspace mx-auto min-h-screen max-w-6xl">
      <header className="flex items-center justify-between gap-4 border-b border-[var(--line)] pb-3">
        <Link
          href={`/dashboard/events?org=${event.orgId}`}
          className="inline-flex min-h-11 items-center gap-2 text-sm text-[var(--muted)] whitespace-nowrap"
        >
          <ArrowLeft size={16} aria-hidden="true" /> Workspace events
        </Link>
        <span className="truncate text-sm">{event.title}</span>
      </header>
      <nav
        aria-label="Event sections"
        className="mt-3 flex gap-2 overflow-x-auto border-b border-[var(--line)] pb-3"
      >
        {tabs.map(([label, suffix]) => (
          <NavigationLink
            key={label}
            href={`/dashboard/events/${id}${suffix}`}
            exact
            className="inline-flex min-h-11 items-center whitespace-nowrap rounded-lg px-3 py-2 text-sm hover:bg-[var(--surface)] dark:hover:bg-[var(--surface)]"
          >
            {label}
          </NavigationLink>
        ))}
      </nav>
      {children}
    </div>
  );
}
