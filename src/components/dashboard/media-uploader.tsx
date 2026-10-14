"use client";
/* eslint-disable @next/next/no-img-element -- Local file previews. */
import { useEffect, useRef, useState } from "react";
import { MediaDialog } from "./media-dialog";
import {
  mediaRoles,
  roleNames,
  type MediaRole,
  type MediaImage,
} from "./media-types";
import { imageFileError } from "@/lib/media-file";
type Entry = {
  id: string;
  file: File;
  kind: MediaRole;
  preview: string;
  status:
    | "Waiting"
    | "Uploading"
    | "Processing"
    | "Completed"
    | "Failed"
    | "Cancelled";
  progress: number;
  detail: string;
  error?: string;
  signed?: { url: string; token: string };
  uploaded?: boolean;
  imageId?: string;
};
export function MediaUploader({
  eventId,
  close,
  onReady,
  role = "GALLERY",
  replacement,
  existing,
  limit = 20,
}: {
  eventId: string;
  close(): void;
  onReady(image: MediaImage): void;
  role?: MediaRole;
  replacement?: MediaImage;
  existing: MediaImage[];
  limit?: number;
}) {
  const [kind, setKind] = useState<MediaRole>(role);
  const [entries, setEntries] = useState<Entry[]>([]);
  const queue = useRef<Entry[]>([]);
  const urls = useRef<string[]>([]);
  const alive = useRef(true);
  const [notice, setNotice] = useState("");
  const [running, setRunning] = useState(false);
  const run = useRef(false);
  const controller = useRef<AbortController | null>(null);
  const xhr = useRef<XMLHttpRequest | null>(null);
  const input = useRef<HTMLInputElement>(null);
  function publish() {
    if (alive.current) setEntries([...queue.current]);
  }
  useEffect(() => {
    alive.current = true;
    const previews = urls.current;
    return () => {
      alive.current = false;
      controller.current?.abort();
      xhr.current?.abort();
      previews.forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);
  function add(files: FileList | File[] | null) {
    if (!files) return;
    setNotice("");
    for (const file of Array.from(files)) {
      if (replacement && queue.current.some((e) => e.status !== "Cancelled")) {
        setNotice("Replace one image at a time.");
        break;
      }
      if (
        existing.length +
          queue.current.filter(
            (e) => e.status !== "Completed" && e.status !== "Cancelled",
          ).length >=
        limit
      ) {
        setNotice(
          `This event allows ${limit} images. Remove an image before adding more.`,
        );
        break;
      }
      // shortcut: duplicate detection uses file metadata; add stored content hashes if exact library matching becomes necessary.
      if (
        queue.current.some(
          (e) =>
            e.file.name === file.name &&
            e.file.size === file.size &&
            e.file.lastModified === file.lastModified,
        ) ||
        (!replacement &&
          existing.some(
            (image) =>
              image.alt === file.name.replace(/\.[^.]+$/, "") &&
              image.sizeBytes === file.size,
          ))
      ) {
        setNotice(
          `${file.name} appears to be in this upload or library. Choose it from the library or use Replace.`,
        );
        continue;
      }
      const error = imageFileError(file);
      const preview = error ? "" : URL.createObjectURL(file);
      if (preview) urls.current.push(preview);
      queue.current.push({
        id: crypto.randomUUID(),
        file,
        kind,
        preview,
        status: error ? "Failed" : "Waiting",
        progress: 0,
        detail: "",
        error,
      });
    }
    publish();
    if (input.current) input.current.value = "";
  }
  async function json(url: string, body?: unknown, signal?: AbortSignal) {
    const response = await fetch(url, {
      ...(body
        ? {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          }
        : {}),
      signal,
    });
    const data = await response.json();
    if (!response.ok)
      throw new Error(data.error || "Could not upload this image.");
    return data;
  }
  async function start() {
    if (run.current) return;
    run.current = true;
    setRunning(true);
    setNotice("");
    try {
      for (const entry of queue.current) {
        if (!alive.current) break;
        if (entry.status !== "Waiting") continue;
        const abort = new AbortController();
        controller.current = abort;
        try {
          const error = imageFileError(entry.file);
          if (error) throw new Error(error);
          entry.status = "Uploading";
          entry.error = undefined;
          publish();
          const mime = entry.file.type || "image/heic";
          if (!entry.signed)
            entry.signed = await json(
              "/api/uploads/presign",
              {
                eventId,
                kind: replacement ? "GALLERY" : entry.kind,
                mime,
                sizeBytes: entry.file.size,
              },
              abort.signal,
            );
          if (!entry.uploaded) {
            await new Promise<void>((resolve, reject) => {
              const request = new XMLHttpRequest();
              xhr.current = request;
              request.open("PUT", entry.signed!.url);
              request.setRequestHeader("Content-Type", mime);
              request.timeout = 300000;
              const began = performance.now();
              request.upload.onprogress = (e) => {
                if (!e.lengthComputable) return;
                entry.progress = Math.round((e.loaded / e.total) * 100);
                const elapsed = (performance.now() - began) / 1000;
                const eta =
                  e.loaded && elapsed > 1
                    ? Math.ceil((e.total - e.loaded) / (e.loaded / elapsed))
                    : null;
                entry.detail = `${(e.loaded / 1048576).toFixed(1)} / ${(e.total / 1048576).toFixed(1)} MB${eta !== null ? ` · about ${eta}s left` : ""}`;
                publish();
              };
              request.onload = () => {
                if(request.status>=200&&request.status<300)return resolve();
                if(request.status===403)entry.signed=undefined;
                reject(new Error(request.status===403?"Upload link expired. Retry to renew it.":"Upload failed. Retry this file."));
              };
              request.onerror = () =>
                reject(new Error("Connection lost. Retry this file."));
              request.ontimeout = () =>
                reject(new Error("Upload timed out. Retry this file."));
              request.onabort = () =>
                reject(new DOMException("Cancelled", "AbortError"));
              request.send(entry.file);
            });
            entry.uploaded = true;
          }
          if (!entry.imageId)
            entry.imageId = (
              await json(
                "/api/uploads/confirm",
                {
                  token: entry.signed!.token,
                  alt:
                    entry.file.name.replace(/\.[^.]+$/, "").slice(0, 300) ||
                    "Event image",
                },
                abort.signal,
              )
            ).id;
          entry.status = "Processing";
          entry.progress = 0;
          entry.detail = "Preparing optimized images…";
          publish();
          let image: MediaImage | undefined;
          for (let n = 0; n < 150; n++) {
            if (abort.signal.aborted)
              throw new DOMException("Cancelled", "AbortError");
            const data = await json(
              `/api/events/${eventId}/images/${entry.imageId}`,
              undefined,
              abort.signal,
            );
            if (data.image.processingError)
              throw new Error(data.image.processingError);
            entry.progress = data.progress;
            entry.detail = data.progress
              ? `Optimizing image formats · ${data.progress}%`
              : "Queued for image processing…";
            publish();
            if (data.image.variants) {
              image = data.image;
              break;
            }
            await new Promise((resolve) => setTimeout(resolve, 2000));
          }
          if (!image)
            throw new Error(
              "Processing is taking longer. Retry status or close and return later.",
            );
          if (replacement) {
            const response = await fetch(
              `/api/events/${eventId}/images/${replacement.id}`,
              {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  replacementId: image.id,
                  replacementRole: replacement.kind,
                }),
                signal: abort.signal,
              },
            );
            if (!response.ok) throw new Error((await response.json()).error);
            image = await response.json();
          }
          entry.status = "Completed";
          entry.progress = 100;
          publish();
          if (alive.current) onReady(image!);
        } catch (error) {
          entry.status =
            error instanceof DOMException && error.name === "AbortError"
              ? "Cancelled"
              : "Failed";
          entry.error =
            error instanceof Error ? error.message : "Upload failed.";
          if (entry.error.includes("Upload token has expired")) {
            entry.signed = undefined;
            entry.uploaded = false;
          }
          publish();
        }
      }
    } finally {
      run.current = false;
      if (alive.current) setRunning(false);
      controller.current = null;
      xhr.current = null;
    }
  }
  const pending = entries.some((e) =>
    ["Waiting", "Uploading", "Failed"].includes(e.status),
  );
  return (
    <MediaDialog
      title={replacement ? "Replace image" : "Add media"}
      close={close}
      dirty={pending}
      wide
    >
      <p className="mm-hint">
        {replacement
          ? "Your previous image stays in the gallery. The replacement takes its place only after processing."
          : "Choose a role, then drop images here. Originals are always preserved."}
      </p>
      {!replacement && (
        <label className="mm-field">
          Media type
          <select
            value={kind}
            disabled={running}
            aria-label="Media type"
            onChange={(e) => {const role=e.target.value as MediaRole;setKind(role);queue.current.forEach(entry=>{if(entry.status==="Waiting"&&!entry.signed)entry.kind=role;});publish();}}
          >
            {mediaRoles.map((role) => (
              <option key={role} value={role}>
                {roleNames[role]}
              </option>
            ))}
          </select>
          {(kind==="COVER"||kind==="POSTER")&&<small>One {roleNames[kind].toLowerCase()} per event. If you add several, the last becomes the {roleNames[kind].toLowerCase()} and the others move to the gallery.</small>}
        </label>
      )}
      <div
        className="mm-dropzone"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          if (!running) add(e.dataTransfer.files);
        }}
      >
        <span aria-hidden="true">↑</span>
        <button
          type="button"
          onClick={() => input.current?.click()}
          disabled={running}
        >
          Choose images
        </button>
        <small>
          or drag & drop · up to 10 MB each · JPEG, PNG, WebP, AVIF, GIF, HEIC
        </small>
        <input
          ref={input}
          type="file"
          multiple={!replacement}
          accept="image/jpeg,image/png,image/webp,image/avif,image/gif,image/heic,image/heif,.heic,.heif"
          aria-label="Choose media files"
          onChange={(e) => add(e.target.files)}
          hidden
        />
      </div>
      {notice && (
        <p role="alert" className="mm-error">
          {notice}
        </p>
      )}
      <ul className="mm-upload-list">
        {entries.map((entry) => (
          <li key={entry.id}>
            <div className="mm-file-thumb">
              {entry.preview && (
                <img
                  src={entry.preview}
                  alt=""
                  onError={(e) => {
                    e.currentTarget.hidden = true;
                  }}
                />
              )}
            </div>
            <div>
              <strong title={entry.file.name}>{entry.file.name}</strong>
              <small>
                {roleNames[entry.kind]} ·{" "}
                {(entry.file.size / 1048576).toFixed(1)} MB · {entry.status}
                {entry.status === "Completed" ? " ✓" : ""}
              </small>
              {["Uploading", "Processing"].includes(entry.status) && (
                <>
                  <progress
                    value={entry.progress}
                    max={100}
                    aria-label={`${entry.file.name} ${entry.status.toLowerCase()} progress`}
                  />
                  <small role="status">{entry.detail}</small>
                </>
              )}
              {entry.error && <small role="alert" className="mm-error">{entry.error}</small>}
            </div>
            <div>
              {["Uploading", "Processing"].includes(entry.status) ? (
                <button
                  type="button"
                  onClick={() => {
                    controller.current?.abort();
                    xhr.current?.abort();
                  }}
                >
                  Cancel
                </button>
              ) : (
                <>
                  {(entry.status === "Failed" ||
                    entry.status === "Cancelled") && (
                    <button
                      type="button"
                      disabled={running || !!imageFileError(entry.file)}
                      onClick={async () => {
                        try {
                          if (entry.imageId) {
                            const data = await json(
                              `/api/events/${eventId}/images/${entry.imageId}`,
                            );
                            if (data.image.processingError) {
                              const response = await fetch(
                                `/api/events/${eventId}/images/${entry.imageId}`,
                                {
                                  method: "PATCH",
                                  headers: {
                                    "Content-Type": "application/json",
                                  },
                                  body: JSON.stringify({ retry: true }),
                                },
                              );
                              if (!response.ok)
                                throw new Error("Could not retry processing.");
                            }
                          }
                          entry.status = "Waiting";
                          entry.error = undefined;
                          publish();
                          void start();
                        } catch (error) {
                          entry.error =
                            error instanceof Error
                              ? error.message
                              : "Could not retry.";
                          publish();
                        }
                      }}
                    >
                      Retry
                    </button>
                  )}
                  {entry.status !== "Completed" && (
                    <button
                      type="button"
                      onClick={() => {
                        entry.status = "Cancelled";
                        queue.current = queue.current.filter(
                          (e) => e.id !== entry.id,
                        );
                        publish();
                      }}
                    >
                      Remove
                    </button>
                  )}
                </>
              )}
            </div>
          </li>
        ))}
      </ul>
      <footer>
        <span role="status">
          {entries.filter((e) => e.status === "Completed").length} completed ·{" "}
          {entries.filter((e) => e.status === "Waiting").length} waiting
        </span>
        <button
          type="button"
          className="m-button"
          disabled={running || !entries.some((e) => e.status === "Waiting")}
          onClick={() => void start()}
        >
          {running ? "Uploading & processing…" : "Upload images"}
        </button>
        <button
          type="button"
          disabled={running}
          onClick={() => {
            if (!pending || confirm("Discard the remaining files?")) close();
          }}
        >
          Done
        </button>
      </footer>
    </MediaDialog>
  );
}
