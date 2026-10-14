"use client";
/* eslint-disable @next/next/no-img-element -- Worker-optimized event poster. */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { whatsappEventUrl } from "@/lib/event-share";

export function EventShare({
  eventId,
  slug,
  title,
  summary,
  poster,
  base,
  published,
}: {
  eventId: string;
  slug: string;
  title: string;
  summary: string | null;
  poster: string | null;
  base: string;
  published: boolean;
}) {
  const router = useRouter();
  const [value, setValue] = useState(slug);
  const [saved, setSaved] = useState(slug);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const url = `${base}/e/${saved}`;
  return (
    <section className="mt-8 space-y-4">
      <h2 className="text-xl font-semibold">Event link & share preview</h2>
      <form
        className="space-y-3"
        onSubmit={async (e) => {
          e.preventDefault();
          if (
            value !== saved &&
            !window.confirm(
              "Changing this URL will stop previously shared links from working. Continue?",
            )
          )
            return;
          setBusy(true);
          setError("");
          setMessage("");
          try {
            const response = await fetch(`/api/events/${eventId}/share`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ slug: value }),
            });
            const result = await response.json();
            if (!response.ok) {
              setError(result.error || "Could not save the link.");
              return;
            }
            setSaved(result.slug);
            setMessage("Event link saved.");
            router.refresh();
          } catch {
            setError("Connection interrupted. Please try again.");
          } finally {
            setBusy(false);
          }
        }}
      >
        <label htmlFor="event-share-slug">Event URL name</label>
        <input
          id="event-share-slug"
          className="w-full rounded-xl border border-[var(--line)] bg-transparent px-4 py-3"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setError("");
          }}
          required
          minLength={3}
          maxLength={100}
          pattern="[a-z0-9]+(-[a-z0-9]+)*"
          autoCapitalize="none"
          spellCheck={false}
          readOnly={busy}
          aria-invalid={!!error}
          aria-describedby="event-share-help event-share-error"
        />
        <p id="event-share-help" className="text-sm text-[var(--muted)]">
          Lowercase letters, numbers and hyphens. Changing the URL breaks old
          shared links.
        </p>
        <p id="event-share-error" role="alert" className="m-field-error">
          {error}
        </p>
        <button
          className="m-button m-button-small"
          disabled={busy || value === saved}
        >
          {busy ? "Saving…" : "Save URL"}
        </button>
      </form>
      <div
        className="overflow-hidden rounded-xl border border-[var(--line)]"
        style={{ maxWidth: 440 }}
      >
        {poster ? (
          <img
            src={poster}
            alt={`${title} share poster`}
            className="w-full object-contain"
            style={{ maxHeight: 240 }}
          />
        ) : (
          <div className="p-6 text-[var(--muted)]">
            Add a poster in Media for an image preview.
          </div>
        )}
        <div className="space-y-2 p-4">
          <strong>{title}</strong>
          <p className="text-sm text-[var(--muted)]">
            {summary || "Discover this event on Raunak."}
          </p>
          <p className="break-all text-xs">{url}</p>
        </div>
      </div>
      <p className="text-sm text-[var(--muted)]">
        Preview illustration. WhatsApp may crop the poster or cache an older
        preview. Publish the event before sharing.
      </p>
      {published && (
        <div className="flex flex-wrap gap-4">
          <a
            className="r-quiet-button"
            href={whatsappEventUrl(title, url)}
            target="_blank"
            rel="noopener noreferrer"
          >
            Share on WhatsApp ↗
          </a>
          <button
            className="r-quiet-button"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(url);
                setMessage("Link copied.");
              } catch {
                setMessage("Could not copy. Select the URL above to copy it.");
              }
            }}
          >
            Copy link
          </button>
        </div>
      )}
      <p role="status">{message}</p>
    </section>
  );
}
