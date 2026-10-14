"use client";
import { useEffect, useRef, useState } from "react";
import type { IScannerControls } from "@zxing/browser";
import { useRouter } from "next/navigation";
type Attendee = {
  id: string;
  holderName: string;
  holderEmail: string;
  holderPhone: string | null;
  code: string;
  status: string;
  ticketType: { name: string };
};
type Outcome = {
  result: "VALID" | "ALREADY_USED" | "INVALID" | "ERROR";
  ticket: {
    holderName: string;
    code: string;
    ticketType: { name: string };
    checkedInAt: string | null;
    checkedInBy: { name: string | null } | null;
  } | null;
};
export function CheckinScanner({ eventId }: { eventId: string }) {
  const router = useRouter();
  const video = useRef<HTMLVideoElement>(null);
  const controls = useRef<IScannerControls | null>(null);
  const paused = useRef(false);
  const mounted = useRef(true);
  const audio = useRef<AudioContext | null>(null);
  const [camera, setCamera] = useState(false);
  const [starting, setStarting] = useState(false);
  const [torchAvailable, setTorchAvailable] = useState(false);
  const [torch, setTorch] = useState(false);
  const [sound, setSound] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Attendee[]>([]);
  const [searched, setSearched] = useState(false);
  const [searching, setSearching] = useState(false);
  const resultHeading = useRef<HTMLHeadingElement>(null);
  useEffect(()=>{if(outcome)resultHeading.current?.focus();},[outcome]);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      controls.current?.stop();
      void audio.current?.close();
    };
  }, []);
  function feedback(valid: boolean) {
    navigator.vibrate?.(valid ? 80 : [80, 50, 80]);
    if (audio.current?.state === "running") {
      const oscillator = audio.current.createOscillator();
      const gain = audio.current.createGain();
      gain.gain.value = 0.08;
      oscillator.frequency.value = valid ? 880 : 220;
      oscillator.connect(gain);
      gain.connect(audio.current.destination);
      oscillator.start();
      oscillator.stop(audio.current.currentTime + 0.12);
    }
  }
  async function submit(input: { token: string } | { ticketId: string }) {
    if (paused.current) return;
    paused.current = true;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId, ...input }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      if (!mounted.current) return;
      setOutcome(data);
      feedback(data.result === "VALID");
      router.refresh();
    } catch (error) {
      if (mounted.current) {
        setOutcome({ result: "ERROR", ticket: null });
        setError(
          error instanceof Error ? error.message : "Could not check in.",
        );
        feedback(false);
      }
    } finally {
      if (mounted.current) setBusy(false);
    }
  }
  async function startCamera() {
    setStarting(true);
    setError("");
    paused.current = false;
    setOutcome(null);
    try {
      const { BrowserQRCodeReader } = await import("@zxing/browser");
      const reader = new BrowserQRCodeReader();
      const control = await reader.decodeFromConstraints(
        { video: { facingMode: { ideal: "environment" } } },
        video.current!,
        (result) => {
          if (result && !paused.current)
            void submit({ token: result.getText() });
        },
      );
      if (!mounted.current) {
        control.stop();
        return;
      }
      controls.current = control;
      setCamera(true);
      setTorchAvailable(Boolean(control.switchTorch));
    } catch {
      setError(
        "Camera could not start. Allow camera access, or use manual search below.",
      );
    } finally {
      if (mounted.current) setStarting(false);
    }
  }
  return (
    <section className="r-scanner space-y-5">
      <div className="r-scan-intro"><div><h2>Welcome them in.</h2><p>Scan a ticket QR or find a guest below.</p></div><span>{camera ? "● Camera live" : "Camera off"}</span></div>
      <div className="r-scan-grid">
        <div className="r-camera-panel">
          <div className="r-camera-frame">
          <video
            ref={video}
            className="aspect-[4/3] w-full rounded-xl bg-zinc-950 object-cover"
            muted
            playsInline
            aria-label="QR camera preview"
          />
          <div className="r-scan-target" aria-hidden="true"/>
          {!camera && <div className="r-camera-placeholder"><span aria-hidden="true">▣</span><p>{starting ? "Opening camera…" : "Ready when you are"}</p><small>Use your rear camera for the clearest scan.</small></div>}
          {camera && <span className="r-camera-caption">{busy ? "Checking ticket…" : outcome ? "Paused · review result" : "Place the QR inside the frame"}</span>}
          </div>
          <div className="mt-4 flex flex-wrap gap-3">
            {!camera ? (
              <button
                className="rounded-xl bg-[var(--accent)] px-5 py-3 text-white"
                disabled={starting || busy}
                onClick={startCamera}
              >
                {starting ? "Starting camera…" : "Start camera"}
              </button>
            ) : (
              <button
                className="rounded-xl border px-5 py-3"
                onClick={() => {
                  controls.current?.stop();
                  controls.current = null;
                  setCamera(false);
                  setTorchAvailable(false);
                  setTorch(false);
                }}
              >
                Stop camera
              </button>
            )}
            {torchAvailable && (
              <button
                className="rounded-xl border px-5 py-3"
                onClick={async () => {
                  try {
                    await controls.current?.switchTorch?.(!torch);
                    setTorch(!torch);
                  } catch {
                    setError("Torch is unavailable on this camera.");
                  }
                }}
              >
                Torch {torch ? "off" : "on"}
              </button>
            )}
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={sound}
                onChange={async (e) => {
                  const enabled = e.target.checked;
                  setSound(enabled);
                  if (enabled) {
                    audio.current ||= new AudioContext();
                    await audio.current.resume();
                  } else {
                    await audio.current?.suspend();
                  }
                }}
              />
              Sound
            </label>
          </div>
          <p className="mt-3 text-sm">
            Each valid scan admits one guest. Keep this screen open for the next ticket.
          </p>
        </div>
        <div
          className="r-scan-result"
          data-result={outcome?.result || "READY"}
          role="status"
          aria-live="polite"
        >
          <p className="text-sm uppercase tracking-widest">Entry check</p>
          <div className="r-scan-symbol" aria-hidden="true">{busy ? "…" : outcome?.result === "VALID" ? "✓" : outcome?.result === "ALREADY_USED" ? "!" : outcome ? "×" : "▣"}</div>
          <h2 ref={resultHeading} tabIndex={-1} className="mt-3 text-2xl font-semibold">
            {busy
              ? "Checking…"
              : outcome?.result === "VALID"
                ? "Welcome in."
                : outcome?.result === "ALREADY_USED"
                  ? "Already checked in"
                  : outcome?.result === "ERROR"
                    ? "Could not check ticket"
                  : outcome
                    ? "Invalid ticket"
                    : "Ready to scan"}
          </h2>
          {outcome?.ticket && (
            <div className="mt-5">
              <p className="text-xl">{outcome.ticket.holderName}</p>
              <p>
                {outcome.ticket.ticketType.name} · {outcome.ticket.code}
              </p>
              {outcome.result === "ALREADY_USED" && (
                <p className="mt-3">
                  {outcome.ticket.checkedInAt
                    ? new Date(outcome.ticket.checkedInAt).toLocaleString()
                    : "Already used"}{" "}
                  · {outcome.ticket.checkedInBy?.name || "Entry staff"}
                </p>
              )}
            </div>
          )}
          {error && (
            <p role="alert" className="mt-4">
              {error}
            </p>
          )}
          {outcome && (
            <button
              className="mt-6 rounded-xl border border-current px-5 py-3"
              onClick={() => {
                paused.current = false;
                setOutcome(null);
                setError("");
              }}
            >
              {outcome.result === "ERROR" ? "Try again / scan next" : "Scan next guest"}
            </button>
          )}
        </div>
      </div>
      <form
        className="rounded-2xl border border-[var(--line)] p-5"
        onSubmit={async (e) => {
          e.preventDefault();
          setError("");
          setSearching(true);
          try {
            const response = await fetch(
              `/api/checkin?${new URLSearchParams({ eventId, q: query })}`,
            );
            const data = await response.json();
            if (!response.ok) throw new Error(data.error);
            setResults(data);
            setSearched(true);
          } catch (error) {
            setError(error instanceof Error ? error.message : "Search failed.");
          } finally {setSearching(false);}
        }}
      >
        <label htmlFor="gate-search" className="block font-semibold">
          Find an attendee manually
        </label>
        <div className="mt-3 flex gap-3">
          <input
            id="gate-search"
            className="min-w-0 flex-1 rounded-xl border bg-transparent p-3"
            value={query}
            minLength={2}
            maxLength={100}
            required
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Name, email, phone, or ticket code"
          />
          <button disabled={searching} className="rounded-xl border px-5 py-3">{searching ? "Searching…" : "Find guest"}</button>
        </div>
        {searched && !results.length && (
          <p className="mt-4">No paid tickets match this search.</p>
        )}
        <div className="mt-4 space-y-3">
          {results.map((ticket) => (
            <div
              key={ticket.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4"
            >
              <div>
                <b>{ticket.holderName}</b>
                <p className="text-sm">
                  {ticket.ticketType.name} · {ticket.code} · {ticket.status}
                </p>
                <p className="text-sm">{ticket.holderEmail}</p>
              </div>
              <button
                type="button"
                className="rounded-xl border px-4 py-2"
                disabled={busy || ticket.status !== "VALID"}
                onClick={() => {
                  paused.current = false;
                  void submit({ ticketId: ticket.id });
                }}
              >
                Check in
              </button>
            </div>
          ))}
        </div>
      </form>
    </section>
  );
}
