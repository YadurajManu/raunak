"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { localEventTimeToUtc } from "@/lib/dates";

type EventValues = {
  id: string;
  title: string;
  summary: string | null;
  description: string | null;
  category: string | null;
  mode: string;
  visibility: string;
  startsAt: string;
  endsAt: string;
  timezone: string;
  venueName: string | null;
  address: string | null;
  mapUrl: string | null;
  city: string | null;
  onlineUrl: string | null;
  capacity: number | null;
  refundPolicy: string | null;
};

export function EventForm({
  orgId,
  event,
}: {
  orgId?: string;
  event?: EventValues;
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const form = new FormData(e.currentTarget);
      const timezone = String(form.get("timezone"));
      const body = {
        orgId,
        title: String(form.get("title")),
        summary: String(form.get("summary")),
        description: String(form.get("description")),
        category: String(form.get("category")),
        mode: String(form.get("mode")),
        visibility: String(form.get("visibility")),
        startsAt: localEventTimeToUtc(String(form.get("startsAt")), timezone),
        endsAt: localEventTimeToUtc(String(form.get("endsAt")), timezone),
        timezone,
        venueName: String(form.get("venueName")),
        address: String(form.get("address")),
        mapUrl: String(form.get("mapUrl")) || undefined,
        city: String(form.get("city")),
        onlineUrl: String(form.get("onlineUrl")) || undefined,
        capacity: form.get("capacity")
          ? Number(form.get("capacity"))
          : undefined,
        refundPolicy: String(form.get("refundPolicy")),
      };
      const response = await fetch(
        event ? `/api/events/${event.id}` : "/api/events",
        {
          method: event ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.error || "Could not save event.");
      if (event) {
        router.refresh();
        setBusy(false);
        setError("Saved.");
      } else router.push(`/dashboard/events/${result.id}/media`);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not save event.",
      );
      setBusy(false);
    }
  }
  const input =
    "mt-2 w-full rounded-xl border border-zinc-300 bg-transparent px-4 py-3 dark:border-zinc-700";
  return (
    <form onSubmit={submit} className="mt-8 space-y-8">
      <section className="grid gap-5 sm:grid-cols-2">
        <label className="sm:col-span-2 text-sm font-medium">
          Event title
          <input
            name="title"
            required
            minLength={3}
            maxLength={150}
            defaultValue={event?.title}
            className={input}
          />
        </label>
        <label className="sm:col-span-2 text-sm font-medium">
          Short summary
          <input
            name="summary"
            maxLength={300}
            defaultValue={event?.summary || ""}
            className={input}
          />
        </label>
        <label className="sm:col-span-2 text-sm font-medium">
          Description (Markdown supported)
          <textarea
            name="description"
            rows={8}
            maxLength={30000}
            defaultValue={event?.description || ""}
            className={input}
          />
        </label>
        <label className="text-sm font-medium">
          Category
          <input
            name="category"
            maxLength={80}
            defaultValue={event?.category || ""}
            className={input}
          />
        </label>
        <label className="text-sm font-medium">
          Visibility
          <select
            name="visibility"
            defaultValue={event?.visibility || "PUBLIC"}
            className={input}
          >
            <option value="PUBLIC">Public</option>
            <option value="UNLISTED">Unlisted</option>
          </select>
        </label>
      </section>
      <section className="grid gap-5 border-t border-zinc-200 pt-7 dark:border-zinc-800 sm:grid-cols-2">
        <h2 className="sm:col-span-2 text-xl font-semibold">When and where</h2>
        <label className="text-sm font-medium">
          Starts
          <input
            name="startsAt"
            type="datetime-local"
            required
            defaultValue={event?.startsAt}
            className={input}
          />
        </label>
        <label className="text-sm font-medium">
          Ends
          <input
            name="endsAt"
            type="datetime-local"
            required
            defaultValue={event?.endsAt}
            className={input}
          />
        </label>
        <label className="text-sm font-medium">
          Event timezone
          <input
            name="timezone"
            required
            defaultValue={event?.timezone || "Asia/Kolkata"}
            list="timezones"
            className={input}
          />
          <datalist id="timezones">
            <option value="Asia/Kolkata" />
            <option value="UTC" />
            <option value="Asia/Dubai" />
            <option value="Europe/London" />
          </datalist>
        </label>
        <label className="text-sm font-medium">
          Format
          <select
            name="mode"
            defaultValue={event?.mode || "IN_PERSON"}
            className={input}
          >
            <option value="IN_PERSON">In person</option>
            <option value="ONLINE">Online</option>
            <option value="HYBRID">Hybrid</option>
          </select>
        </label>
        <label className="text-sm font-medium">
          Venue name
          <input
            name="venueName"
            maxLength={150}
            defaultValue={event?.venueName || ""}
            className={input}
          />
        </label>
        <label className="text-sm font-medium">
          City
          <input
            name="city"
            maxLength={100}
            defaultValue={event?.city || ""}
            className={input}
          />
        </label>
        <label className="sm:col-span-2 text-sm font-medium">
          Address
          <input
            name="address"
            maxLength={500}
            defaultValue={event?.address || ""}
            className={input}
          />
        </label>
        <label className="sm:col-span-2 text-sm font-medium">
          Map link
          <input name="mapUrl" type="url" defaultValue={event?.mapUrl || ""} className={input} />
        </label>
        <label className="sm:col-span-2 text-sm font-medium">
          Online event link
          <input
            name="onlineUrl"
            type="url"
            defaultValue={event?.onlineUrl || ""}
            className={input}
          />
        </label>
      </section>
      <section className="grid gap-5 border-t border-zinc-200 pt-7 dark:border-zinc-800 sm:grid-cols-2">
        <h2 className="sm:col-span-2 text-xl font-semibold">Policies</h2>
        <label className="text-sm font-medium">
          Event capacity
          <input
            name="capacity"
            type="number"
            min={1}
            defaultValue={event?.capacity || ""}
            className={input}
          />
        </label>
        <label className="sm:col-span-2 text-sm font-medium">
          Refund policy
          <textarea
            name="refundPolicy"
            rows={4}
            maxLength={5000}
            defaultValue={event?.refundPolicy || ""}
            className={input}
          />
        </label>
      </section>
      <button
        disabled={busy}
        className="rounded-xl bg-indigo-600 px-5 py-3 font-medium text-white disabled:opacity-50"
      >
        {event ? "Save details" : "Create draft and continue"}
      </button>
      {error && (
        <p role="status" className="text-sm text-red-600">
          {error}
        </p>
      )}
    </form>
  );
}
