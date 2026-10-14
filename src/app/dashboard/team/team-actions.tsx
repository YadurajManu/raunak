"use client";
import { useState } from "react";

type Member = { userId: string; role: string; name: string | null; email: string };
export function TeamActions({ orgId, members }: { orgId: string; members: Member[] }) {
  const [message, setMessage] = useState("");
  async function invite(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setMessage("");
    const data = new FormData(event.currentTarget);
    const response = await fetch(`/api/orgs/${orgId}/invites`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: data.get("email"), role: data.get("role") }) });
    const result = await response.json();
    setMessage(response.ok ? "Invitation sent." : result.error || "Could not send invitation.");
  }
  async function update(userId: string, method: "PATCH" | "DELETE", role?: string) {
    const response = await fetch(`/api/orgs/${orgId}/members/${userId}`, { method, headers: { "Content-Type": "application/json" }, body: role ? JSON.stringify({ role }) : undefined });
    const result = await response.json();
    if (response.ok) window.location.reload(); else setMessage(result.error || "Could not update member.");
  }
  return <section className="mt-8 space-y-6">
    <form onSubmit={invite} className="flex flex-wrap items-end gap-3 rounded-2xl border border-zinc-200 p-5 dark:border-zinc-800"><div><label htmlFor="invite-email" className="block text-sm font-medium">Invite by email</label><input id="invite-email" name="email" type="email" required className="mt-2 rounded-xl border border-zinc-300 bg-transparent px-3 py-2 dark:border-zinc-700" /></div><div><label htmlFor="invite-role" className="block text-sm font-medium">Role</label><select id="invite-role" name="role" className="mt-2 rounded-xl border border-zinc-300 bg-transparent px-3 py-2 dark:border-zinc-700"><option value="ADMIN">Admin</option><option value="MANAGER">Event Manager</option><option value="CHECKIN">Check-in Staff</option><option value="FINANCE">Finance</option></select></div><button className="rounded-xl bg-indigo-600 px-4 py-2 font-medium text-white">Send invite</button></form>
    <div className="space-y-3">{members.filter(m => m.role !== "OWNER").map(member => <div key={member.userId} className="flex flex-wrap items-center gap-3 text-sm"><span className="w-52 truncate">{member.email}</span><select aria-label={`Role for ${member.email}`} value={member.role} onChange={event => update(member.userId, "PATCH", event.target.value)} className="rounded-lg border border-zinc-300 bg-transparent px-2 py-1 dark:border-zinc-700"><option value="ADMIN">Admin</option><option value="MANAGER">Event Manager</option><option value="CHECKIN">Check-in Staff</option><option value="FINANCE">Finance</option></select><button onClick={() => update(member.userId, "DELETE")} className="text-red-600">Remove</button></div>)}</div>
    {message && <p role="status" className="text-sm">{message}</p>}
  </section>;
}
