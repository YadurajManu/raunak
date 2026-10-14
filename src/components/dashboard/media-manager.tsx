"use client";
/* eslint-disable @next/next/no-img-element -- Optimized storage variants. */
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { variantUrl } from "@/lib/images";
import { MediaUploader } from "./media-uploader";
import { MediaDialog } from "./media-dialog";
import { ImageEditor, ProcessingStatus } from "./media-tools";
import { PeopleManager } from "./people-manager";
import {
  roleNames,
  mediaRoles,
  type MediaImage,
  type MediaRole,
  type LineupPerson,
} from "./media-types";

export function MediaManager({
  eventId,
  initialImages,
  initialPeople,
}: {
  eventId: string;
  initialImages: MediaImage[];
  initialPeople: LineupPerson[];
}) {
  const router = useRouter();
  const [images, setImages] = useState(initialImages);
  const [last, setLast] = useState(initialImages);
  if (last !== initialImages) {
    setLast(initialImages);
    setImages(initialImages);
  }
  const [upload, setUpload] = useState<{
    role: MediaRole;
    replacement?: MediaImage;
  } | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [preview, setPreview] = useState<MediaImage | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [dragged, setDragged] = useState<string | null>(null);
  const lock = useRef(false);
  const refresh = () => router.refresh();
  async function mutate(action: () => Promise<void>) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setMessage("");
    try {
      await action();
      setMessage("Changes saved.");
      refresh();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Could not save. Please try again.",
      );
      refresh();
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  async function request(path: string, method: string, body?: unknown) {
    const r = await fetch(`/api/events/${eventId}/${path}`, {
      method,
      headers: { "Content-Type": "application/json" },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || "Could not save changes.");
    return data;
  }
  function reorder(id: string, target: string) {
    if (busy || id === target) return;
    const before = images;
    const next = images.filter((image) => image.id !== id);
    const moving = images.find((image) => image.id === id);
    if (!moving) return;
    next.splice(
      images.findIndex((image) => image.id === target),
      0,
      moving,
    );
    setImages(next);
    void mutate(async () => {
      try {
        await request(
          "images/order",
          "PATCH",
          next.map((image) => image.id),
        );
      } catch (error) {
        setImages(before);
        throw error;
      }
    });
  }
  function remove(ids: string[]) {
    if (
      !confirm(
        `Delete ${ids.length === 1 ? "this image" : `${ids.length} images`}? Linked lineup photos will be cleared. This cannot be undone.`,
      )
    )
      return;
    void mutate(async () => {
      let deleted = 0;
      for (const id of ids) {
        await request(`images/${id}`, "DELETE");
        setImages((current) => current.filter((image) => image.id !== id));
        deleted++;
      }
      setSelected([]);
      setEditing(null);
      setMessage(`${deleted} image(s) deleted.`);
    });
  }
  const gallery = images.filter((image) => image.kind === "GALLERY");
  const photos = images.filter((image) => image.kind === "PERSON");
  const current = images.find((image) => image.id === editing);
  function card(image: MediaImage, list: MediaImage[], hero = false) {
    const thumb = variantUrl(image.variants, hero ? "card" : "thumb");
    const index = list.findIndex((item) => item.id === image.id);
    return (
      <li
        key={image.id}
        className={`mm-card ${hero ? `mm-${image.kind.toLowerCase()}` : ""} ${selected.includes(image.id) ? "is-selected" : ""} ${dragged === image.id ? "is-dragging" : ""}`}
        onDragOver={(e) => {
          if (dragged) {
            e.preventDefault();
            e.dataTransfer.dropEffect = "move";
          }
        }}
        onDrop={(e) => {
          e.preventDefault();
          if (dragged) reorder(dragged, image.id);
          setDragged(null);
        }}
      >
        <button
          type="button"
          className="mm-thumbnail"
          onClick={() => setEditing(image.id)}
          aria-label={`Edit ${image.alt}`}
        >
          {thumb ? (
            <img
              src={thumb}
              alt={image.alt}
              loading="lazy"
              width={hero ? 640 : 320}
              height={hero ? 360 : 320}
            />
          ) : (
            <span>Preparing image…</span>
          )}
        </button>
        {!image.variants && (
          <ProcessingStatus
            eventId={eventId}
            imageId={image.id}
            onReady={refresh}
          />
        )}
        <div className="mm-card-bar">
          <label title={`Select ${image.alt}`}>
            <input
              aria-label={`Select ${image.alt}`}
              type="checkbox"
              checked={selected.includes(image.id)}
              onChange={(e) =>
                setSelected(
                  e.target.checked
                    ? [...selected, image.id]
                    : selected.filter((id) => id !== image.id),
                )
              }
            />
          </label>
          <span title={image.alt}>{image.alt}</span>
          <details name="media-image-actions" onClick={e=>{if(e.target instanceof HTMLElement&&e.target.closest("button"))e.currentTarget.open=false;}}>
            <summary aria-label={`Actions for ${image.alt}`}>•••</summary>
            <div className="mm-card-menu">
              <button type="button" onClick={() => setPreview(image)}>
                Preview
              </button>
              <button type="button" onClick={() => setEditing(image.id)}>
                Edit details / crop
              </button>
              <button
                type="button"
                onClick={() =>
                  setUpload({
                    role: image.kind as MediaRole,
                    replacement: image,
                  })
                }
              >
                Replace
              </button>
              {!hero && (
                <>
                  <button
                    type="button"
                    disabled={index === 0 || busy}
                    onClick={() => reorder(image.id, list[index - 1].id)}
                  >
                    Move earlier
                  </button>
                  <button
                    type="button"
                    disabled={index === list.length - 1 || busy}
                    onClick={() => reorder(image.id, list[index + 1].id)}
                  >
                    Move later
                  </button>
                </>
              )}
              <button
                type="button"
                disabled={busy}
                onClick={() => remove([image.id])}
              >
                Delete
              </button>
            </div>
          </details>
        </div>
        {!hero && (
          <button
            type="button"
            className="mm-drag"
            draggable={!busy}
            onDragStart={(e) => {
              setDragged(image.id);
              e.dataTransfer.setData("text/plain", image.id);
              e.dataTransfer.effectAllowed = "move";
            }}
            onDragEnd={() => setDragged(null)}
            aria-label={`Reorder ${image.alt}. Use actions to move earlier or later.`}
            title="Drag to reorder; use Actions on touch or keyboard"
          >
            ⠿
          </button>
        )}
      </li>
    );
  }
  return (
    <div className="mm-editor">
      <div className="mm-toolbar">
        <div>
          <h1>Media & lineup</h1>
          <p>
            {images.length} / 20 images · the pictures and people behind your
            event
          </p>
        </div>
        <button
          type="button"
          className="m-button"
          disabled={busy || images.length >= 20}
          onClick={() => setUpload({ role: "GALLERY" })}
        >
          ＋ Add media
        </button>
      </div>
      {message && (
        <p role="status" className="mm-feedback">
          {message}
        </p>
      )}
      {!!selected.length && (
        <div
          className="mm-selection"
          role="region"
          aria-label="Selected images"
        >
          <span>{selected.length} selected</span>
          <button
            type="button"
            disabled={busy}
            onClick={() => remove(selected)}
          >
            Delete selected
          </button>
          <button type="button" onClick={() => setSelected([])}>
            Clear selection
          </button>
        </div>
      )}
      <section className="mm-section">
        <div className="mm-section-heading">
          <h2>Cover & poster</h2>
          <small>The first impression of your event</small>
        </div>
        <div className="mm-brand-images">
          {(["COVER", "POSTER"] as const).map((role) => {
            const image = images.find((image) => image.kind === role);
            return (
              <div key={role}>
                <div className="mm-slot-label">
                  <strong>{roleNames[role]}</strong>
                  <small>
                    {role === "COVER"
                      ? "Event header · 16:9 recommended"
                      : "Discover card · 4:5 recommended"}
                  </small>
                </div>
                {image ? (
                  <ul>{card(image, [image], true)}</ul>
                ) : (
                  <button
                    type="button"
                    className={`mm-empty-slot ${role.toLowerCase()}`}
                    onClick={() => setUpload({ role })}
                  >
                    <span>＋</span>Add {roleNames[role].toLowerCase()}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </section>
      <section className="mm-section">
        <div className="mm-section-heading">
          <h2>
            Event gallery <span>{gallery.length}</span>
          </h2>
          <button type="button" onClick={() => setUpload({ role: "GALLERY" })}>
            Add photos ↗
          </button>
        </div>
        {gallery.length ? (
          <ul className="mm-gallery">
            {gallery.map((image) => card(image, gallery))}
          </ul>
        ) : (
          <button
            type="button"
            className="mm-empty"
            onClick={() => setUpload({ role: "GALLERY" })}
          >
            ＋ Add a few photos to set the scene. Drop a batch in one go.
          </button>
        )}
      </section>
      <PeopleManager
        eventId={eventId}
        people={initialPeople}
        images={images}
        refresh={refresh}
        onUpload={() => setUpload({ role: "PERSON" })}
      />
      {!!photos.length && (
        <details className="mm-photo-library">
          <summary>People photo library · {photos.length}</summary>
          <ul className="mm-gallery">
            {photos.map((image) => card(image, photos))}
          </ul>
        </details>
      )}
      <div className="mm-footer">
        <small>
          Original files stay intact when you crop. Cover and poster can be
          changed without uploading again.
        </small>
        <button type="button" onClick={refresh}>
          Refresh media status
        </button>
      </div>
      {upload && (
        <MediaUploader
          eventId={eventId}
          role={upload.role}
          replacement={upload.replacement}
          existing={images}
          close={() => {
            setUpload(null);
            refresh();
          }}
          onReady={(image) => {
            setImages((current) => [
              ...current.filter((item) => item.id !== image.id),
              image,
            ]);
            refresh();
          }}
        />
      )}
      {current && (
        <ImageDetails
          key={current.id}
          eventId={eventId}
          image={current}
          close={() => setEditing(null)}
          save={async (data) => {
            await request(`images/${current.id}`, "PATCH", data);
            refresh();
            setMessage("Image updated.");
          }}
          replace={() => {
            setEditing(null);
            setUpload({
              role: current.kind as MediaRole,
              replacement: current,
            });
          }}
          remove={() => remove([current.id])}
          refresh={refresh}
        />
      )}
      {preview && (
        <MediaDialog
          title={preview.alt || "Image preview"}
          close={() => setPreview(null)}
          wide
        >
          <img
            className="mm-full-preview"
            src={
              variantUrl(preview.variants, "hero") ||
              variantUrl(preview.variants, "card") ||
              ""
            }
            alt={preview.alt}
          />
          <p className="mm-hint">
            {roleNames[preview.kind as MediaRole]} ·{" "}
            {(preview.sizeBytes / 1048576).toFixed(1)} MB · {preview.width} ×{" "}
            {preview.height}px
          </p>
        </MediaDialog>
      )}
    </div>
  );
}
function ImageDetails({
  eventId,
  image,
  close,
  save,
  replace,
  remove,
  refresh,
}: {
  eventId: string;
  image: MediaImage;
  close(): void;
  save(data: unknown): Promise<void>;
  replace(): void;
  remove(): void;
  refresh(): void;
}) {
  const [alt, setAlt] = useState(image.alt);
  const [kind, setKind] = useState(image.kind);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const dirty = alt !== image.alt || kind !== image.kind;
  return (
    <MediaDialog title="Image details" close={close} dirty={dirty} wide>
      <div className="mm-detail-layout">
        <div>
          <img
            className="mm-detail-preview"
            src={variantUrl(image.variants, "hero") || ""}
            alt={image.alt}
          />
          <div className="mm-detail-tools">
            <ImageEditor eventId={eventId} image={image} done={refresh} />
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                if (
                  !dirty ||
                  confirm("Discard unsaved details and replace this image?")
                )
                  replace();
              }}
            >
              Replace image
            </button>
          </div>
          <small>
            {image.width || "—"} × {image.height || "—"} px ·{" "}
            {(image.sizeBytes / 1048576).toFixed(1)} MB · {image.mime}
          </small>
        </div>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError("");
            try {
              await save({ alt, kind });
              close();
            } catch (error) {
              setError(
                error instanceof Error ? error.message : "Could not save.",
              );
              setBusy(false);
            }
          }}
        >
          <label className="mm-field">
            Media role
            <select
              aria-label="Media role"
              value={kind}
              onChange={(e) => setKind(e.target.value)}
            >
              {mediaRoles.map((role) => (
                <option key={role} value={role}>
                  {roleNames[role]}
                </option>
              ))}
            </select>
          </label>
          <label className="mm-field">
            Alt text
            <input
              aria-label="Alt text"
              required
              maxLength={300}
              value={alt}
              onChange={(e) => setAlt(e.target.value)}
            />
            <small>Describe the image for guests using screen readers.</small>
          </label>
          <p className="mm-hint">
            Assigning Cover or Poster moves the previous image into your
            gallery.
          </p>
          {error && (
            <p role="alert" className="mm-error">
              {error}
            </p>
          )}
          <footer>
            <button
              type="submit"
              className="m-button"
              disabled={busy || !dirty}
            >
              {busy ? "Saving…" : "Save changes"}
            </button>
            <button
              type="button"
              onClick={() => {
                if (!dirty || confirm("Discard unsaved changes?")) close();
              }}
            >
              Cancel
            </button>
          </footer>
          <button
            type="button"
            className="mm-delete"
            disabled={busy}
            onClick={remove}
          >
            Delete image
          </button>
        </form>
      </div>
    </MediaDialog>
  );
}
