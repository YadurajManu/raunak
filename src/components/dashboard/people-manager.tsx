"use client";
/* eslint-disable @next/next/no-img-element -- Optimized event image variants. */
import { useRef, useState } from "react";
import { variantUrl } from "@/lib/images";
import { personRoles } from "@/config/event-options";
import { MediaDialog } from "./media-dialog";
import { MediaUploader } from "./media-uploader";
import { ImageEditor } from "./media-tools";
import type { MediaImage, LineupPerson } from "./media-types";
export function PeopleManager({
  eventId,
  people,
  images,
  refresh,
  onUpload,
}: {
  eventId: string;
  people: LineupPerson[];
  images: MediaImage[];
  refresh(): void;
  onUpload(): void;
}) {
  const [items, setItems] = useState(people);
  const [last, setLast] = useState(people);
  if (last !== people) {
    setLast(people);
    setItems(people);
  }
  const [editing, setEditing] = useState<LineupPerson | "new" | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [dragged, setDragged] = useState<string | null>(null);
  const lock = useRef(false);
  async function reorder(id: string, target: string) {
    if (lock.current || id === target) return;
    const before = items;
    const person = items.find((p) => p.id === id);
    if (!person) return;
    const next = items.filter((p) => p.id !== id);
    next.splice(
      items.findIndex((p) => p.id === target),
      0,
      person,
    );
    setItems(next);
    setBusy(true);
    lock.current = true;
    setMessage("");
    try {
      const r = await fetch(`/api/events/${eventId}/people/order`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next.map((p) => p.id)),
      });
      if (!r.ok) throw new Error((await r.json()).error);
      setMessage("Lineup order saved.");
      refresh();
    } catch (error) {
      setItems(before);
      setMessage(
        error instanceof Error ? error.message : "Could not save order.",
      );
      refresh();
    } finally {
      setBusy(false);
      lock.current = false;
    }
  }
  async function remove(person: LineupPerson) {
    if (
      !confirm(
        `Remove ${person.name} from the lineup? Their photo will remain in your library.`,
      )
    )
      return;
    setBusy(true);
    setMessage("");
    try {
      const r = await fetch(`/api/events/${eventId}/people/${person.id}`, {
        method: "DELETE",
      });
      if (!r.ok) throw new Error((await r.json()).error);
      setItems((current) => current.filter((p) => p.id !== person.id));
      refresh();
      setMessage("Person removed.");
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Could not remove person.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="mm-section mm-lineup">
      <div className="mm-section-heading">
        <div>
          <h2>
            People & lineup <span>{items.length}</span>
          </h2>
          <p>Introduce the people making it happen.</p>
        </div>
        <button
          type="button"
          className="mm-secondary"
          onClick={() => setEditing("new")}
        >
          ＋ Add person
        </button>
      </div>
      {message && (
        <p role="status" className="mm-feedback">
          {message}
        </p>
      )}
      {items.length ? (
        <ul className="mm-people-list">
          {items.map((person, index) => {
            const image = images.find(
              (image) => image.storageKey === person.photoKey,
            );
            const src = image && variantUrl(image.variants, "thumb");
            return (
              <li
                key={person.id}
                className={dragged === person.id ? "is-dragging" : ""}
                onDragOver={(e) => {
                  if (dragged) e.preventDefault();
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  if (dragged) void reorder(dragged, person.id);
                  setDragged(null);
                }}
              >
                <button
                  type="button"
                  className="mm-person-drag"
                  draggable={!busy}
                  onDragStart={(e) => {
                    setDragged(person.id);
                    e.dataTransfer.setData("text/plain", person.id);
                    e.dataTransfer.effectAllowed = "move";
                  }}
                  onDragEnd={() => setDragged(null)}
                  aria-label={`Reorder ${person.name}. Use actions for keyboard and touch.`}
                >
                  ⠿
                </button>
                <div className="mm-person-avatar">
                  {src ? (
                    <img
                      src={src}
                      alt=""
                      loading="lazy"
                      width={48}
                      height={48}
                    />
                  ) : (
                    person.name.slice(0, 1).toUpperCase()
                  )}
                </div>
                <div className="mm-person-copy">
                  <strong>{person.name}</strong>
                  <span>{person.title || "Participant"}</span>
                  {person.bio && <small title={person.bio}>{person.bio}</small>}
                </div>
                <button type="button" onClick={() => setEditing(person)}>
                  Edit
                </button>
                <details name="lineup-person-actions" onClick={e=>{if(e.target instanceof HTMLElement&&e.target.closest("button"))e.currentTarget.open=false;}}>
                  <summary aria-label={`Actions for ${person.name}`}>
                    •••
                  </summary>
                  <div className="mm-card-menu">
                    <button
                      type="button"
                      disabled={busy || index === 0}
                      onClick={() =>
                        void reorder(person.id, items[index - 1].id)
                      }
                    >
                      Move earlier
                    </button>
                    <button
                      type="button"
                      disabled={busy || index === items.length - 1}
                      onClick={() =>
                        void reorder(person.id, items[index + 1].id)
                      }
                    >
                      Move later
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void remove(person)}
                    >
                      Remove
                    </button>
                  </div>
                </details>
              </li>
            );
          })}
        </ul>
      ) : (
        <button
          type="button"
          className="mm-empty"
          onClick={() => setEditing("new")}
        >
          ＋ Add an artist, speaker or host. A name is all you need to start.
        </button>
      )}
      {!!items.length && (
        <button type="button" className="mm-subtle" onClick={onUpload}>
          Add photos to the people library
        </button>
      )}
      {editing && (
        <PersonDialog
          key={editing === "new" ? "new" : editing.id}
          eventId={eventId}
          person={editing === "new" ? undefined : editing}
          images={images}
          close={() => setEditing(null)}
          done={(person) => {
            setItems(current=>current.some(p=>p.id===person.id)?current.map(p=>p.id===person.id?person:p):[...current,person]);
            setEditing(null);
            refresh();
            setMessage("Person saved.");
          }}
          refresh={refresh}
        />
      )}
    </section>
  );
}
function PersonDialog({
  eventId,
  person,
  images,
  close,
  done,
  refresh,
}: {
  eventId: string;
  person?: LineupPerson;
  images: MediaImage[];
  close(): void;
  done(person: LineupPerson): void;
  refresh(): void;
}) {
  const [name, setName] = useState(person?.name || "");
  const [title, setTitle] = useState(person?.title || "");
  const [bio, setBio] = useState(person?.bio || "");
  const [photo, setPhoto] = useState(
    images.find((image) => image.storageKey === person?.photoKey)?.id || "",
  );
  const [upload, setUpload] = useState(false);
  const [localPhoto, setLocalPhoto] = useState<MediaImage | null>(null);
  const [pick, setPick] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const links = (Array.isArray(person?.links) ? person.links : []) as {
    label: string;
    url: string;
  }[];
  const [website, setWebsite] = useState(
    links.find((link) => link.label === "Website")?.url || "",
  );
  const library = localPhoto && !images.some(image=>image.id===localPhoto.id) ? [...images,localPhoto] : images;
  const selected = library.find((image) => image.id === photo);
  const url = selected && variantUrl(selected.variants, "thumb");
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const r = await fetch(
        `/api/events/${eventId}/people${person ? `/${person.id}` : ""}`,
        {
          method: person ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name,
            title,
            bio,
            photoImageId: photo || null,
            links: [
              ...links.filter((link) => link.label !== "Website"),
              ...(website ? [{ label: "Website", url: website }] : []),
            ],
          }),
        },
      );
      if (!r.ok) throw new Error((await r.json()).error);
      done(await r.json());
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Could not save person.",
      );
      setBusy(false);
    }
  }
  return (
    <MediaDialog
      title={person ? "Edit person" : "Add person"}
      close={close}
      dirty={dirty}
    >
      <form onSubmit={save} onChange={() => setDirty(true)}>
        <div className="mm-person-photo">
          <div className="mm-person-avatar is-large">
            {url ? (
              <img src={url} alt="Selected person photo" />
            ) : (
              name.slice(0, 1).toUpperCase() || "＋"
            )}
          </div>
          <div>
            <button type="button" onClick={() => setUpload(true)}>
              Upload a photo
            </button>
            <button type="button" onClick={() => setPick(!pick)}>
              Choose existing
            </button>
            {photo && (
              <button
                type="button"
                onClick={() => {
                  setPhoto("");
                  setDirty(true);
                }}
              >
                Remove photo
              </button>
            )}
            {selected && (
              <ImageEditor eventId={eventId} image={selected} done={refresh} />
            )}
          </div>
        </div>
        {pick && (
          <div
            className="mm-photo-picker"
            role="group"
            aria-label="Choose a person photo"
          >
            {library
              .filter((image) => image.variants)
              .map((image) => (
                <button
                  type="button"
                  key={image.id}
                  aria-label={`Use ${image.alt} as photo`}
                  aria-pressed={photo === image.id}
                  onClick={() => {
                    setPhoto(image.id);
                    setDirty(true);
                    setPick(false);
                  }}
                >
                  <img
                    src={variantUrl(image.variants, "thumb") || ""}
                    alt={image.alt}
                    loading="lazy"
                    width={64}
                    height={64}
                  />
                </button>
              ))}
            {!library.some((image) => image.variants) && (
              <p className="mm-hint">No photos yet. Upload one above.</p>
            )}
          </div>
        )}
        <label className="mm-field">
          Name
          <input
            required
            maxLength={100}
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="name"
          />
        </label>
        <label className="mm-field">
          Role / title
          <input
            list="lineup-role-options"
            maxLength={100}
            value={title}
            placeholder="Choose a role or type your own"
            onChange={(e) => setTitle(e.target.value)}
          />
          <datalist id="lineup-role-options">
            {personRoles.map((role) => (
              <option key={role} value={role} />
            ))}
          </datalist>
        </label>
        <label className="mm-field">
          Short bio <span>optional</span>
          <textarea
            rows={3}
            maxLength={2000}
            value={bio}
            onChange={(e) => setBio(e.target.value)}
          />
        </label>
        <details className="mm-optional">
          <summary>Website or social link · optional</summary>
          <label className="mm-field">
            Website
            <input
              type="url"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              placeholder="https://…"
            />
          </label>
        </details>
        {error && (
          <p role="alert" className="mm-error">
            {error}
          </p>
        )}
        <footer>
          <button
            type="button"
            onClick={() => {
              if (!dirty || confirm("Discard your unsaved changes?")) close();
            }}
          >
            Cancel
          </button>
          <button className="m-button" disabled={busy}>
            {busy ? "Saving…" : "Save person"}
          </button>
        </footer>
      </form>
      {upload && (
        <MediaUploader
          eventId={eventId}
          role="PERSON"
          existing={library}
          close={() => setUpload(false)}
          onReady={(image) => {
            setLocalPhoto(image);
            setPhoto(image.id);
            setDirty(true);
            refresh();
          }}
        />
      )}
    </MediaDialog>
  );
}
