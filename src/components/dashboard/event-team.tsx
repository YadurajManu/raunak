"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

type Person = { id: string; name: string | null; email: string; role: string };
export function EventTeam({
  eventId,
  canManage,
  members,
  assigned,
}: {
  eventId: string;
  canManage: boolean;
  members: Person[];
  assigned: Person[];
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  async function assign(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const userId = new FormData(event.currentTarget).get("userId");
    const response = await fetch(`/api/events/${eventId}/staff`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    });
    if (response.ok) router.refresh();
    else setError((await response.json()).error || "Could not assign member.");
  }
  async function unassign(userId: string) {
    const response = await fetch(`/api/events/${eventId}/staff/${userId}`, {
      method: "DELETE",
    });
    if (response.ok) router.refresh();
    else
      setError((await response.json()).error || "Could not unassign member.");
  }
  return (
    <>
      <ul className="mt-8 divide-y divide-zinc-200 rounded-2xl border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
        {assigned.length ? (
          assigned.map((person) => (
            <li
              key={person.id}
              className="flex items-center justify-between gap-4 p-4"
            >
              <span>
                {person.name || person.email}
                <span className="block text-sm text-zinc-500">
                  {person.role}
                </span>
              </span>
              {canManage && (
                <button
                  onClick={() => unassign(person.id)}
                  className="text-sm text-red-600"
                >
                  Remove
                </button>
              )}
            </li>
          ))
        ) : (
          <li className="p-6 text-zinc-500">
            No one is assigned to this event yet.
          </li>
        )}
      </ul>
      {canManage && (
        <form onSubmit={assign} className="mt-6 flex flex-wrap items-end gap-3">
          <div>
            <label htmlFor="staff-user" className="block text-sm font-medium">
              Add team member
            </label>
            <select
              id="staff-user"
              name="userId"
              required
              className="mt-2 rounded-xl border border-zinc-300 bg-transparent px-4 py-2 dark:border-zinc-700"
            >
              <option value="">Select member</option>
              {members
                .filter(
                  (member) =>
                    !assigned.some((person) => person.id === member.id),
                )
                .map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.name || member.email} · {member.role}
                  </option>
                ))}
            </select>
          </div>
          <button className="rounded-xl bg-indigo-600 px-4 py-2 font-medium text-white">
            Assign
          </button>
        </form>
      )}
      {error && (
        <p role="alert" className="mt-4 text-sm text-red-600">
          {error}
        </p>
      )}
    </>
  );
}
