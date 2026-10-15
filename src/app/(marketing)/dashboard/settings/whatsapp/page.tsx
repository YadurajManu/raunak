import Link from "next/link";
import { requireUser } from "@/server/auth/session";
import { db } from "@/server/db/client";
import { WhatsAppIntegration } from "@/components/dashboard/whatsapp-integration";
import "./whatsapp.css";
export const metadata = {
  title: "WhatsApp integration",
  robots: { index: false, follow: false },
};
export default async function WhatsAppSettings({
  searchParams,
}: {
  searchParams: Promise<{ org?: string }>;
}) {
  const user = await requireUser(),
    query = await searchParams;
  const memberships = await db.organizationMember.findMany({
    where: {
      userId: user.id,
      status: "ACTIVE",
      role: { in: ["OWNER", "ADMIN"] },
    },
    include: { org: { select: { id: true, name: true } } },
  });
  const selected =
    memberships.find((member) => member.orgId === query.org) ||
    (!query.org ? memberships[0] : undefined);
  return (
    <>
      <nav
        className="wa-workspaces"
        aria-label="Workspace integration settings"
      >
        {memberships.map(({ org }) => (
          <Link
            key={org.id}
            href={`/dashboard/settings/whatsapp?org=${org.id}`}
            aria-current={org.id === selected?.orgId ? "page" : undefined}
          >
            {org.name}
          </Link>
        ))}
      </nav>
      {selected ? (
        <WhatsAppIntegration key={selected.orgId} orgId={selected.orgId} />
      ) : (
        <section>
          <h1>WhatsApp integrations</h1>
          <p>
            Only workspace owners and administrators can manage WhatsApp
            connections.
          </p>
          <Link href="/dashboard">Back to workspaces</Link>
        </section>
      )}
    </>
  );
}
