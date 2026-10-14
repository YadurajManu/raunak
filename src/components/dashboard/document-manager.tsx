"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
export function DocumentManager({
  eventId,
  documents,
}: {
  eventId: string;
  documents: { id: string; name: string; size: number }[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function upload(file?: File) {
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      const body = new FormData();
      body.set("document", file);
      const response = await fetch(`/api/events/${eventId}/documents`, {
        method: "POST",
        body,
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      router.refresh();
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Could not upload PDF.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function remove(id: string) {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/events/${eventId}/documents/${id}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Could not remove PDF.");
      router.refresh();
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Could not remove PDF.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="r-settings-card">
      <p className="m-eyebrow">EVENT GUIDES & THE FINER DETAILS</p>
      <h2>Bring the whole story.</h2>
      <p>
        Attach a programme, venue guide or event brochure. Up to 10 PDFs, 10 MB
        each. Published event documents can be downloaded by guests, so leave
        private information out.
      </p>
      <label className="m-button m-button-small">
        {busy ? "Working…" : "Add a PDF ↗"}
        <input
          type="file"
          accept="application/pdf,.pdf"
          disabled={busy || documents.length >= 10}
          className="sr-only"
          onChange={(e) => {
            void upload(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
      </label>
      <ul>
        {documents.map((document) => (
          <li key={document.id} className="r-document-row">
            <a href={`/api/events/${eventId}/documents/${document.id}`}>
              {document.name} ↗{" "}
              <small>({(document.size / 1024 / 1024).toFixed(1)} MB)</small>
            </a>
            <button
              type="button"
              disabled={busy}
              onClick={() => remove(document.id)}
            >
              Remove
            </button>
          </li>
        ))}
      </ul>
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
