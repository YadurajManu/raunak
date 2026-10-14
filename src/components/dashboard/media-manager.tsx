"use client";

/* eslint-disable @next/next/no-img-element -- Images use pre-generated S3 variants. */

import { useState } from "react";
import { useRouter } from "next/navigation";

type Image = {
  id: string;
  kind: string;
  alt: string;
  storageKey: string;
  sortOrder: number;
  variants: unknown;
  processingError: string | null;
};
type Person = {
  id: string;
  name: string;
  title: string | null;
  bio: string | null;
  photoKey: string | null;
};
const kinds = ["POSTER", "COVER", "GALLERY", "PERSON"] as const;

function variant(image: Image, size: string, format: string) {
  if (typeof image.variants !== "object" || image.variants === null)
    return null;
  const sizes = image.variants as Record<string, Record<string, string>>;
  return sizes[size]?.[format] ?? null;
}

function Upload({
  eventId,
  kind,
  done,
}: {
  eventId: string;
  kind: (typeof kinds)[number];
  done(): void;
}) {
  const [progress, setProgress] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    setError("");
    try {
      for (const file of Array.from(files)) {
        const mime =
          file.type || (/\.hei[cf]$/i.test(file.name) ? "image/heic" : "");
        const presigned = await fetch("/api/uploads/presign", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ eventId, kind, mime, sizeBytes: file.size }),
        });
        const signed = await presigned.json();
        if (!presigned.ok) throw new Error(signed.error);
        await new Promise<void>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open("PUT", signed.url);
          xhr.setRequestHeader("Content-Type", mime);
          xhr.upload.onprogress = (event) => {
            if (event.lengthComputable)
              setProgress(Math.round((event.loaded / event.total) * 100));
          };
          xhr.onload = () =>
            xhr.status >= 200 && xhr.status < 300
              ? resolve()
              : reject(new Error("Upload failed."));
          xhr.onerror = () => reject(new Error("Upload failed."));
          xhr.send(file);
        });
        const confirmed = await fetch("/api/uploads/confirm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            token: signed.token,
            alt: file.name.replace(/\.[^.]+$/, ""),
          }),
        });
        if (!confirmed.ok)
          throw new Error(
            (await confirmed.json()).error || "Could not confirm image.",
          );
      }
      done();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Upload failed.");
    } finally {
      setBusy(false);
      setProgress(0);
    }
  }
  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium" htmlFor={`upload-${kind}`}>
        Add {kind.toLowerCase()} images
      </label>
      <input
        id={`upload-${kind}`}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/avif,image/gif,image/heic,image/heif,.heic,.heif"
        multiple
        onChange={(event) => upload(event.target.files)}
        disabled={busy}
        className="block max-w-full text-sm"
      />
      {busy && (
        <progress
          value={progress}
          max={100}
          aria-label="Upload progress"
          className="w-full"
        />
      )}
      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}

export function MediaManager({
  eventId,
  initialImages,
  initialPeople,
}: {
  eventId: string;
  initialImages: Image[];
  initialPeople: Person[];
}) {
  const router = useRouter();
  const [images, setImages] = useState(initialImages);
  const [message, setMessage] = useState("");
  const [dragged, setDragged] = useState<string | null>(null);
  function refresh() {
    router.refresh();
  }
  async function patchImage(id: string, data: { alt?: string; kind?: string }) {
    const response = await fetch(`/api/events/${eventId}/images/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!response.ok)
      setMessage((await response.json()).error || "Could not update image.");
    else refresh();
  }
  async function removeImage(id: string) {
    if (!confirm("Delete this image?")) return;
    const response = await fetch(`/api/events/${eventId}/images/${id}`, {
      method: "DELETE",
    });
    if (!response.ok)
      setMessage((await response.json()).error || "Could not delete image.");
    else {
      setImages(images.filter((image) => image.id !== id));
      refresh();
    }
  }
  async function reorder(next: Image[]) {
    setImages(next);
    const response = await fetch(`/api/events/${eventId}/images/order`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(next.map((image) => image.id)),
    });
    if (!response.ok)
      setMessage((await response.json()).error || "Could not reorder images.");
    else refresh();
  }
  const photoImages = images.filter((image) => image.kind === "PERSON");
  return (
    <div className="mt-10 grid gap-12 lg:grid-cols-[minmax(0,1fr)_340px]">
      <section>
        <h2 className="text-xl font-semibold">Event images</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Up to 20 images, 10 MB each. Drag cards or use the arrow buttons to
          reorder.
        </p>
        <div className="mt-6 grid gap-5 rounded-2xl border border-[var(--line)] p-5 dark:border-[var(--line)] sm:grid-cols-2">
          <Upload eventId={eventId} kind="POSTER" done={refresh} />
          <Upload eventId={eventId} kind="COVER" done={refresh} />
          <Upload eventId={eventId} kind="GALLERY" done={refresh} />
          <Upload eventId={eventId} kind="PERSON" done={refresh} />
        </div>
        {images.length === 0 ? (
          <p className="mt-8 rounded-2xl border border-dashed border-[var(--line)] p-8 text-center text-[var(--muted)] dark:border-[var(--line)]">
            No images yet. Add a poster to start.
          </p>
        ) : (
          <ul className="mt-8 grid gap-4 sm:grid-cols-2">
            {images.map((image, index) => (
              <li
                key={image.id}
                draggable
                onDragStart={() => setDragged(image.id)}
                onDragOver={(event) => event.preventDefault()}
                onDrop={() => {
                  if (!dragged) return;
                  const next = images.filter((item) => item.id !== dragged);
                  next.splice(
                    index,
                    0,
                    images.find((item) => item.id === dragged)!,
                  );
                  reorder(next);
                  setDragged(null);
                }}
                className="overflow-hidden rounded-2xl border border-[var(--line)] dark:border-[var(--line)]"
              >
                <div className="flex h-44 items-center justify-center bg-[var(--paper-2)] dark:bg-[var(--paper)]">
                  {variant(image, "card", "jpeg") ? (
                    <picture>
                      <source
                        srcSet={variant(image, "card", "avif") || ""}
                        type="image/avif"
                      />
                      <source
                        srcSet={variant(image, "card", "webp") || ""}
                        type="image/webp"
                      />
                      <img
                        src={variant(image, "card", "jpeg")!}
                        alt={image.alt}
                        className="h-full w-full object-cover"
                      />
                    </picture>
                  ) : image.processingError ? (
                    <span className="p-4 text-sm text-red-600">
                      {image.processingError}
                    </span>
                  ) : (
                    <span className="text-sm text-[var(--muted)]">
                      Processing image…
                    </span>
                  )}
                </div>
                <div className="space-y-3 p-4">
                  <select
                    aria-label={`Kind of ${image.alt}`}
                    value={image.kind}
                    onChange={(event) =>
                      patchImage(image.id, { kind: event.target.value })
                    }
                    className="rounded-lg border border-[var(--line)] bg-transparent px-2 py-1 text-sm dark:border-[var(--line)]"
                  >
                    {kinds.map((kind) => (
                      <option key={kind} value={kind}>
                        {kind}
                      </option>
                    ))}
                  </select>
                  <label className="block text-sm">
                    Alt text
                    <input
                      defaultValue={image.alt}
                      onBlur={(event) => {
                        if (event.target.value !== image.alt)
                          patchImage(image.id, { alt: event.target.value });
                      }}
                      className="mt-1 w-full rounded-lg border border-[var(--line)] bg-transparent px-2 py-1 dark:border-[var(--line)]"
                    />
                  </label>
                  <div className="flex gap-3 text-sm">
                    <button
                      disabled={index === 0}
                      onClick={() => {
                        const next = [...images];
                        [next[index - 1], next[index]] = [
                          next[index],
                          next[index - 1],
                        ];
                        reorder(next);
                      }}
                    >
                      Up
                    </button>
                    <button
                      disabled={index === images.length - 1}
                      onClick={() => {
                        const next = [...images];
                        [next[index + 1], next[index]] = [
                          next[index],
                          next[index + 1],
                        ];
                        reorder(next);
                      }}
                    >
                      Down
                    </button>
                    <button
                      onClick={() => removeImage(image.id)}
                      className="ml-auto text-red-600"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
        <button
          onClick={refresh}
          className="mt-5 text-sm text-[var(--accent)] dark:text-[var(--accent)]"
        >
          Refresh processing status
        </button>
        {message && (
          <p role="alert" className="mt-3 text-sm text-red-600">
            {message}
          </p>
        )}
      </section>
      <PeopleEditor
        eventId={eventId}
        people={initialPeople}
        images={photoImages}
        refresh={refresh}
      />
    </div>
  );
}

function PeopleEditor({
  eventId,
  people,
  images,
  refresh,
}: {
  eventId: string;
  people: Person[];
  images: Image[];
  refresh(): void;
}) {
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  async function create(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const data = new FormData(event.currentTarget);
    const response = await fetch(`/api/events/${eventId}/people`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: data.get("name"),
        title: data.get("title"),
        bio: data.get("bio"),
        photoImageId: data.get("photoImageId") || undefined,
      }),
    });
    if (response.ok) refresh();
    else setError((await response.json()).error || "Could not add person.");
  }
  async function remove(id: string) {
    const response = await fetch(`/api/events/${eventId}/people/${id}`, {
      method: "DELETE",
    });
    if (response.ok) refresh();
    else setError((await response.json()).error || "Could not remove person.");
  }
  async function update(event: React.FormEvent<HTMLFormElement>, id: string) {
    event.preventDefault();
    setError("");
    const data = new FormData(event.currentTarget);
    const response = await fetch(`/api/events/${eventId}/people/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: data.get("name"),
        title: data.get("title"),
        bio: data.get("bio"),
        photoImageId: data.get("photoImageId") || null,
      }),
    });
    if (response.ok) {
      setEditing(null);
      refresh();
    } else
      setError((await response.json()).error || "Could not update person.");
  }
  return (
    <section>
      <h2 className="text-xl font-semibold">Lineup and people</h2>
      <p className="mt-1 text-sm text-[var(--muted)]">
        Speakers, performers, guests, and team members.
      </p>
      <form
        onSubmit={create}
        className="mt-6 space-y-4 rounded-2xl border border-[var(--line)] p-5 dark:border-[var(--line)]"
      >
        <label className="block text-sm">
          Name
          <input
            name="name"
            required
            maxLength={100}
            className="mt-1 w-full rounded-lg border border-[var(--line)] bg-transparent px-3 py-2 dark:border-[var(--line)]"
          />
        </label>
        <label className="block text-sm">
          Title
          <input
            name="title"
            maxLength={100}
            className="mt-1 w-full rounded-lg border border-[var(--line)] bg-transparent px-3 py-2 dark:border-[var(--line)]"
          />
        </label>
        <label className="block text-sm">
          Bio
          <textarea
            name="bio"
            maxLength={2000}
            className="mt-1 w-full rounded-lg border border-[var(--line)] bg-transparent px-3 py-2 dark:border-[var(--line)]"
          />
        </label>
        <label className="block text-sm">
          Photo
          <select
            name="photoImageId"
            className="mt-1 w-full rounded-lg border border-[var(--line)] bg-transparent px-3 py-2 dark:border-[var(--line)]"
          >
            <option value="">No photo</option>
            {images.map((image) => (
              <option key={image.id} value={image.id}>
                {image.alt}
              </option>
            ))}
          </select>
        </label>
        <button className="rounded-xl bg-[var(--accent)] px-4 py-2 font-medium text-white">
          Add person
        </button>
      </form>
      {people.length === 0 ? (
        <p className="mt-6 text-sm text-[var(--muted)]">No people added yet.</p>
      ) : (
        <ul className="mt-6 space-y-3">
          {people.map((person) => (
            <li
              key={person.id}
              className="rounded-xl border border-[var(--line)] p-3 dark:border-[var(--line)]"
            >
              {editing === person.id ? (
                <form
                  onSubmit={(event) => update(event, person.id)}
                  className="space-y-3"
                >
                  <label className="block text-sm">
                    Name
                    <input
                      name="name"
                      required
                      defaultValue={person.name}
                      className="mt-1 w-full rounded-lg border border-[var(--line)] bg-transparent px-3 py-2 dark:border-[var(--line)]"
                    />
                  </label>
                  <label className="block text-sm">
                    Title
                    <input
                      name="title"
                      defaultValue={person.title || ""}
                      className="mt-1 w-full rounded-lg border border-[var(--line)] bg-transparent px-3 py-2 dark:border-[var(--line)]"
                    />
                  </label>
                  <label className="block text-sm">
                    Bio
                    <textarea
                      name="bio"
                      defaultValue={person.bio || ""}
                      className="mt-1 w-full rounded-lg border border-[var(--line)] bg-transparent px-3 py-2 dark:border-[var(--line)]"
                    />
                  </label>
                  <label className="block text-sm">
                    Photo
                    <select
                      name="photoImageId"
                      defaultValue={
                        images.find(
                          (image) => image.storageKey === person.photoKey,
                        )?.id || ""
                      }
                      className="mt-1 w-full rounded-lg border border-[var(--line)] bg-transparent px-3 py-2 dark:border-[var(--line)]"
                    >
                      <option value="">No photo</option>
                      {images.map((image) => (
                        <option key={image.id} value={image.id}>
                          {image.alt}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="flex gap-3">
                    <button className="rounded-lg bg-[var(--accent)] px-3 py-2 text-sm text-white">
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditing(null)}
                      className="text-sm"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <div className="flex items-start gap-3">
                  {images.find(
                    (image) =>
                      image.storageKey === person.photoKey &&
                      variant(image, "thumb", "jpeg"),
                  ) && (
                    <img
                      src={variant(
                        images.find(
                          (image) => image.storageKey === person.photoKey,
                        )!,
                        "thumb",
                        "jpeg",
                      )!}
                      alt={person.name}
                      className="h-12 w-12 rounded-full object-cover"
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{person.name}</p>
                    <p className="text-sm text-[var(--muted)]">
                      {person.title}
                    </p>
                    <p className="mt-2 text-sm">{person.bio}</p>
                  </div>
                  <button
                    onClick={() => setEditing(person.id)}
                    className="text-sm text-[var(--accent)]"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => remove(person.id)}
                    className="text-sm text-red-600"
                  >
                    Remove
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      {error && (
        <p role="alert" className="mt-3 text-sm text-red-600">
          {error}
        </p>
      )}
    </section>
  );
}
