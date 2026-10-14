import { APP_NAME } from "@/lib/constants";
import Link from "next/link";
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
    member.role === "CHECKIN"
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
    <div className="mx-auto min-h-screen max-w-6xl px-6 py-8">
      <header className="flex items-center justify-between border-b border-[var(--line)] pb-6 dark:border-[var(--line)]">
        <Link
          href={`/dashboard/events?org=${event.orgId}`}
          className="text-xl font-semibold"
        >
          {APP_NAME}
        </Link>
        <span className="truncate text-sm">{event.title}</span>
      </header>
      <nav
        aria-label="Event sections"
        className="mt-8 flex gap-2 overflow-x-auto border-b border-[var(--line)] pb-3 dark:border-[var(--line)]"
      >
        {tabs.map(([label, suffix]) => (
          <Link
            key={label}
            href={`/dashboard/events/${id}${suffix}`}
            className="rounded-lg px-3 py-2 text-sm hover:bg-[var(--surface)] dark:hover:bg-[var(--surface)]"
          >
            {label}
          </Link>
        ))}
      </nav>
      {children}
    </div>
  );
}
