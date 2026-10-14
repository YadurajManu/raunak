import { APP_NAME } from "@/lib/constants";
import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/server/auth/session";
import { db } from "@/server/db/client";

export default async function DashboardPage() {
  const user = await currentUser();
  if (!user) redirect("/login");
  const memberships = await db.organizationMember.findMany({ where: { userId: user.id, status: "ACTIVE" }, include: { org: true }, orderBy: { createdAt: "asc" } });
  if (!memberships.length) redirect("/onboarding");
  return <main className="mx-auto min-h-screen max-w-5xl px-6 py-8">
    <header className="flex items-center justify-between border-b border-zinc-200 pb-6 dark:border-zinc-800"><Link href="/" className="text-xl font-semibold">{APP_NAME}</Link><span className="text-sm text-zinc-500">{user.email}</span></header>
    <h1 className="mt-12 text-3xl font-semibold">Your workspaces</h1>
    <p className="mt-2 text-zinc-600 dark:text-zinc-400">Choose a workspace to manage its events and team.</p>
    <ul className="mt-8 grid gap-4 sm:grid-cols-2">{memberships.map(({ org, role }) => <li key={org.id}><Link href={`/dashboard/events?org=${org.id}`} className="block rounded-2xl border border-zinc-200 p-6 hover:border-indigo-400 dark:border-zinc-800"><span className="text-xl font-semibold">{org.name}</span><span className="mt-2 block text-sm text-zinc-500">{role}</span></Link></li>)}</ul>
    <Link href="/onboarding" className="mt-8 inline-block text-indigo-600 dark:text-indigo-400">Create another workspace</Link>
  </main>;
}
