"use client";
/* eslint-disable @next/next/no-img-element -- Private originals use short-lived signed URLs. */
import { useEffect, useRef, useState } from "react";
import { cropSchema, type Crop } from "@/lib/image-crop";
import { MediaDialog } from "./media-dialog";

export function ProcessingStatus({
  eventId,
  imageId,
  onReady,
}: {
  eventId: string;
  imageId: string;
  onReady(): void;
}) {
  const [status, setStatus] = useState("Queued for processing…");
  const [progress, setProgress] = useState(0);
  const [failed, setFailed] = useState(false);
  const ready = useRef(onReady);
  useEffect(() => {
    ready.current = onReady;
  }, [onReady]);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    const controller = new AbortController();
    async function poll() {
      try {
        const response = await fetch(
          `/api/events/${eventId}/images/${imageId}`,
          { signal: controller.signal },
        );
        if (!response.ok) throw new Error("Status unavailable. Retrying…");
        const data = await response.json();
        if (stopped) return;
        if (data.image.variants) {
          setStatus("Ready ✓");
          setProgress(100);
          ready.current();
          return;
        }
        if (data.image.processingError) {
          setStatus(data.image.processingError);
          setFailed(true);
          return;
        }
        setProgress(data.progress);
        setStatus(
          data.progress
            ? `Optimizing image formats · ${data.progress}%`
            : "Queued · preparing image…",
        );
      } catch {
        if (stopped) return;
        setStatus("Reconnecting to processing status…");
      }
      if (!stopped) timer = setTimeout(poll, 2000);
    }
    void poll();
    return () => {
      stopped = true;
      controller.abort();
      clearTimeout(timer);
    };
  }, [eventId, imageId, attempt]);
  return (
    <div className="r-processing" role="status">
      <span>{status}</span>
      {!failed && (
        <progress
          max={100}
          value={progress}
          aria-label="Image processing progress"
        />
      )}
      {failed && (
        <button
          type="button"
          onClick={async () => {
            try {
              const response = await fetch(
                `/api/events/${eventId}/images/${imageId}`,
                {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ retry: true }),
                },
              );
              if (!response.ok) throw new Error();
              setFailed(false);
              setProgress(0);
              setStatus("Retrying processing…");
              setAttempt((value) => value + 1);
              ready.current();
            } catch {
              setStatus("Could not retry. Refresh and try again.");
            }
          }}
        >
          Retry processing
        </button>
      )}
    </div>
  );
}
export function ImageEditor({
  eventId,
  image,
  done,
}: {
  eventId: string;
  image: { id: string; alt: string; crop?: unknown };
  done(): void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Crop / resize
      </button>
      {open && (
        <CropDialog
          eventId={eventId}
          image={image}
          close={() => setOpen(false)}
          done={done}
        />
      )}
    </>
  );
}
function CropDialog({
  eventId,
  image,
  close,
  done,
}: {
  eventId: string;
  image: { id: string; alt: string; crop?: unknown };
  close(): void;
  done(): void;
}) {
  const parsed = cropSchema.safeParse(image.crop);
  const original=parsed.success?parsed.data:{aspect:"original",x:.5,y:.5};
  const [crop, setCrop] = useState<Crop>(
    parsed.success ? parsed.data : { aspect: "original", x: 0.5, y: 0.5 },
  );
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [ratio, setRatio] = useState(1);
  useEffect(() => {
    const controller = new AbortController();
    void fetch(`/api/events/${eventId}/images/${image.id}?original=1`, {
      signal: controller.signal,
    })
      .then(async (r) => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then((data) => setUrl(data.originalUrl))
      .catch(() => {
        if (!controller.signal.aborted)
          setError("Could not load the original. Close and try again.");
      });
    return () => controller.abort();
  }, [eventId, image.id]);
  async function save() {
    setBusy(true);
    setError("");
    try {
      const r = await fetch(`/api/events/${eventId}/images/${image.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ crop }),
      });
      if (!r.ok)
        throw new Error((await r.json()).error || "Could not save crop.");
      done();
      close();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save crop.");
      setBusy(false);
    }
  }
  return (
    <MediaDialog title="Frame your image" close={close} dirty={crop.aspect!==original.aspect||crop.x!==original.x||crop.y!==original.y}>
      <p className="mm-hint">Original stays safe. Change the crop any time.</p>
      <fieldset className="r-crop-options">
        <legend>Aspect ratio</legend>
        {(["original", "square", "portrait", "landscape"] as const).map(
          (aspect) => (
            <label key={aspect}>
              <input
                type="radio"
                name="crop-aspect"
                checked={crop.aspect === aspect}
                onChange={() => setCrop({ ...crop, aspect })}
              />
              {
                {
                  original: "Original",
                  square: "Square 1:1",
                  portrait: "Portrait 4:5",
                  landscape: "Wide 16:9",
                }[aspect]
              }
            </label>
          ),
        )}
      </fieldset>
      <div
        className="r-crop-preview"
        style={{
          aspectRatio:
            crop.aspect === "original"
              ? ratio
              : { square: 1, portrait: 4 / 5, landscape: 16 / 9 }[crop.aspect],
        }}
      >
        {url ? (
          <img
            src={url}
            alt={`Crop preview: ${image.alt}`}
            style={{ objectPosition: `${crop.x * 100}% ${crop.y * 100}%` }}
            onLoad={(e) =>
              setRatio(
                e.currentTarget.naturalWidth / e.currentTarget.naturalHeight,
              )
            }
            onError={() =>
              setError("Preview unavailable. Close and reopen the editor.")
            }
          />
        ) : (
          <span>Loading original…</span>
        )}
      </div>
      <div className="r-crop-sliders">
        <label>
          Horizontal position
          <input
            aria-label="Horizontal crop position"
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={crop.x}
            disabled={crop.aspect === "original"}
            onChange={(e) => setCrop({ ...crop, x: Number(e.target.value) })}
          />
        </label>
        <label>
          Vertical position
          <input
            aria-label="Vertical crop position"
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={crop.y}
            disabled={crop.aspect === "original"}
            onChange={(e) => setCrop({ ...crop, y: Number(e.target.value) })}
          />
        </label>
      </div>
      {error && <p role="alert">{error}</p>}
      <div className="r-crop-actions">
        <button
          type="button"
          onClick={() => setCrop({ aspect: "original", x: 0.5, y: 0.5 })}
        >
          Restore original
        </button>
        <button
          type="button"
          className="m-button"
          disabled={busy || !url}
          onClick={save}
        >
          {busy ? "Saving…" : "Save crop"}
        </button>
      </div>
    </MediaDialog>
  );
}
