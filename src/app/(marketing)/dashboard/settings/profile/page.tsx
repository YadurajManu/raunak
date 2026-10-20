import Link from "next/link";
import { requireUser } from "@/server/auth/session";
import { db } from "@/server/db/client";
import { ProfileEditor } from "@/components/dashboard/profile-editor";

export const metadata = {
  title: "Edit organizer profile",
  robots: { index: false, follow: false },
};

type SocialLinks = {
  instagram?: string;
  twitter?: string;
  youtube?: string;
  website?: string;
  linkedin?: string;
};

export default async function ProfileSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ org?: string }>;
}) {
  const user = await requireUser();
  const query = await searchParams;

  const memberships = await db.organizationMember.findMany({
    where: {
      userId: user.id,
      status: "ACTIVE",
      role: { in: ["OWNER", "ADMIN"] },
    },
    include: { org: true },
  });

  const selected =
    memberships.find((member) => member.orgId === query.org) ||
    (!query.org ? memberships[0] : undefined);

  if (!selected)
    return (
      <>
        <h1>Organizer profile</h1>
        <p>Choose a workspace you own or administer.</p>
        <Link href="/dashboard">Back to workspaces</Link>
      </>
    );

  const org = selected.org;

  return (
    <>
      {memberships.length > 1 && (
        <nav
          className="mb-6 flex flex-wrap gap-4"
          aria-label="Workspace profile settings"
        >
          {memberships.map(({ org: workspace }) => (
            <Link
              key={workspace.id}
              href={`/dashboard/settings/profile?org=${workspace.id}`}
              aria-current={workspace.id === org.id ? "page" : undefined}
            >
              {workspace.name}
            </Link>
          ))}
        </nav>
      )}
      <ProfileEditor
        key={org.id}
        orgId={org.id}
        orgSlug={org.slug}
        orgName={org.name}
        initial={{
          tagline: org.tagline || "",
          bio: org.bio || "",
          socialLinks: (org.socialLinks || {}) as SocialLinks,
          supportEmail: org.supportEmail || "",
          supportPhone: org.supportPhone || "",
          profileVisible: org.profileVisible,
        }}
      />
    </>
  );
}
