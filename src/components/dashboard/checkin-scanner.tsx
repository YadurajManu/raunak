"use client";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import type { IScannerControls } from "@zxing/browser";
import { useRouter } from "next/navigation";
import {
  Camera,
  CameraOff,
  Check,
  CircleAlert,
  Flashlight,
  QrCode,
  Search,
  ShieldCheck,
  Volume2,
  WifiOff,
  X,
} from "lucide-react";
import { cameraGuidance } from "@/lib/checkin-camera";
type Attendee = {
  id: string;
  holderName: string;
  holderEmail: string;
  holderPhone: string | null;
  code: string;
  status: string;
  checkedInAt: string | null;
  order: { status: string };
  ticketType: { name: string };
};
type Input = { token: string } | { ticketId: string };
type Outcome = {
  result: "VALID" | "ALREADY_USED" | "INVALID" | "ERROR";
  reason?: string;
  ticket: {
    id: string;
    holderName: string;
    code: string;
    ticketType: { name: string };
    checkedInAt: string | null;
    checkedInBy: { name: string | null } | null;
  } | null;
};
export function CheckinScanner({
  eventId,
  timezone = "Asia/Kolkata",
}: {
  eventId: string;
  timezone?: string;
}) {
  const router = useRouter(),
    id = useId();
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const controls = useRef<IScannerControls | null>(null);
  const generation = useRef(0);
  const inFlight = useRef(false);
  const paused = useRef(false);
  const mounted = useRef(true);
  const audio = useRef<AudioContext | null>(null);
  const searchRequest = useRef<AbortController | null>(null);
  const lastInput = useRef<Input | null>(null);
  const resultHeading = useRef<HTMLHeadingElement>(null);
  const queryInput = useRef<HTMLInputElement>(null);
  const [camera, setCamera] = useState(false),
    [starting, setStarting] = useState(false);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]),
    [device, setDevice] = useState("");
  const [torchAvailable, setTorchAvailable] = useState(false),
    [torch, setTorch] = useState(false);
  const [sound, setSound] = useState(false),
    [busy, setBusy] = useState(false),
    [online, setOnline] = useState(true);
  const [cameraError, setCameraError] = useState<ReturnType<
    typeof cameraGuidance
  > | null>(null);
  const [notice, setNotice] = useState("");
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [query, setQuery] = useState(""),
    [token, setToken] = useState("");
  const [results, setResults] = useState<Attendee[]>([]),
    [searched, setSearched] = useState(false),
    [searching, setSearching] = useState(false),
    [searchError, setSearchError] = useState("");
  const stopCamera = useCallback(() => {
    generation.current++;
    controls.current?.stop();
    controls.current = null;
    stream.current?.getTracks().forEach((track) => track.stop());
    stream.current = null;
    setCamera(false);
    setStarting(false);
    setTorchAvailable(false);
    setTorch(false);
  }, []);
  useEffect(() => {
    if (outcome) resultHeading.current?.focus();
  }, [outcome]);
  useEffect(() => {
    mounted.current = true;
    const connectivity = () => setOnline(navigator.onLine);
    const visibility = () => {
      if (document.visibilityState === "hidden") {
        stopCamera();
        setNotice(
          "Camera paused while this page was hidden. Restart it when you’re ready.",
        );
      }
    };
    connectivity();
    window.addEventListener("online", connectivity);
    window.addEventListener("offline", connectivity);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      mounted.current = false;
      stopCamera();
      searchRequest.current?.abort();
      void audio.current?.close().catch(() => {});
      window.removeEventListener("online", connectivity);
      window.removeEventListener("offline", connectivity);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [stopCamera]);
  function feedback(valid: boolean) {
    try {
      navigator.vibrate?.(valid ? 80 : [80, 50, 80]);
      if (audio.current?.state === "running") {
        const oscillator = audio.current.createOscillator(),
          gain = audio.current.createGain();
        gain.gain.value = 0.08;
        oscillator.frequency.value = valid ? 880 : 220;
        oscillator.connect(gain);
        gain.connect(audio.current.destination);
        oscillator.start();
        oscillator.stop(audio.current.currentTime + 0.12);
      }
    } catch {
      /* Admission feedback must never affect the server result. */
    }
  }
  async function submit(input: Input) {
    if (inFlight.current) return;
    lastInput.current = input;
    paused.current = true;
    if (!navigator.onLine) {
      setOutcome({
        result: "ERROR",
        ticket: null,
        reason:
          "You’re offline. Do not admit the guest yet. Reconnect and retry this ticket for a confirmed result.",
      });
      return;
    }
    inFlight.current = true;
    setBusy(true);
    setOutcome(null);
    try {
      const response = await fetch("/api/checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId, ...input }),
        signal: AbortSignal.timeout(15000),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error || "Check-in is unavailable. Please retry.");
      if (!["VALID", "ALREADY_USED", "INVALID"].includes(data.result))
        throw new Error("No confirmed result was received. Retry this ticket.");
      if (!mounted.current) return;
      setOutcome(data);
      if (data.ticket && data.result !== "INVALID")
        setResults((previous) =>
          previous.map((ticket) =>
            ticket.id === data.ticket.id
              ? {
                  ...ticket,
                  status: "USED",
                  checkedInAt: data.ticket.checkedInAt,
                }
              : ticket,
          ),
        );
      feedback(data.result === "VALID");
      router.refresh();
    } catch (error) {
      if (mounted.current) {
        setOutcome({
          result: "ERROR",
          ticket: null,
          reason:
            error instanceof Error &&
            !["TimeoutError", "AbortError", "TypeError"].includes(error.name)
              ? error.message
              : "The result could not be confirmed. Do not admit this guest yet. Reconnect and retry this same ticket; the server will detect if it already checked in.",
        });
        feedback(false);
      }
    } finally {
      inFlight.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  async function startCamera() {
    if (starting || camera || inFlight.current) return;
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      setCameraError(cameraGuidance({ name: "SecurityError" }));
      return;
    }
    const request = ++generation.current;
    setStarting(true);
    setCameraError(null);
    setNotice("");
    try {
      const media = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: device
          ? { deviceId: { exact: device } }
          : {
              facingMode: { ideal: "environment" },
              width: { ideal: 1280 },
              height: { ideal: 720 },
            },
      });
      if (!mounted.current || request !== generation.current) {
        media.getTracks().forEach((track) => track.stop());
        return;
      }
      stream.current = media;
      const { BrowserQRCodeReader } = await import("@zxing/browser");
      if (!mounted.current || request !== generation.current) {
        media.getTracks().forEach((track) => track.stop());
        return;
      }
      const control = await new BrowserQRCodeReader(undefined, {
        delayBetweenScanAttempts: 120,
        delayBetweenScanSuccess: 700,
      }).decodeFromStream(media, video.current!, (result) => {
        if (
          result &&
          !paused.current &&
          !inFlight.current &&
          request === generation.current
        )
          void submit({ token: result.getText() });
      });
      if (!mounted.current || request !== generation.current) {
        control.stop();
        media.getTracks().forEach((track) => track.stop());
        return;
      }
      controls.current = control;
      setCamera(true);
      const capabilities = media.getVideoTracks()[0]?.getCapabilities?.() as
        (MediaTrackCapabilities & { torch?: boolean }) | undefined;
      setTorchAvailable(Boolean(capabilities?.torch && control.switchTorch));
      const track = media.getVideoTracks()[0];
      if (track)
        track.onended = () => {
          if (request === generation.current && mounted.current) {
            stopCamera();
            setCameraError({
              title: "Camera connection ended",
              message:
                "Reconnect your camera and restart it, or use manual lookup below.",
            });
          }
        };
      try {
        const inputs = await navigator.mediaDevices.enumerateDevices();
        if (mounted.current && request === generation.current)
          setDevices(inputs.filter((item) => item.kind === "videoinput"));
      } catch {
        /* Device selection is optional. */
      }
    } catch (error) {
      if (mounted.current && request === generation.current) {
        stopCamera();
        setCameraError(cameraGuidance(error));
      }
    } finally {
      if (mounted.current && request === generation.current) setStarting(false);
    }
  }
  function reset() {
    paused.current = false;
    setOutcome(null);
    setToken("");
    if (camera) video.current?.scrollIntoView({ block: "center" });
    else queryInput.current?.focus();
  }
  function clearSearch() {
    searchRequest.current?.abort();
    searchRequest.current = null;
    setResults([]);
    setSearched(false);
    setSearchError("");
    setSearching(false);
  }
  async function search() {
    searchRequest.current?.abort();
    if (query.trim().length < 2) {
      setSearchError("Enter at least two characters.");
      return;
    }
    const request = new AbortController();
    searchRequest.current = request;
    setSearching(true);
    setSearched(false);
    setSearchError("");
    setResults([]);
    try {
      const response = await fetch(
        `/api/checkin?${new URLSearchParams({ eventId, q: query.trim() })}`,
        { signal: request.signal, cache: "no-store" },
      );
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error || "Could not search attendees.");
      if (!Array.isArray(data))
        throw new Error("Could not search attendees. Please retry.");
      if (!request.signal.aborted && mounted.current) {
        setResults(data);
        setSearched(true);
      }
    } catch (error) {
      if (!request.signal.aborted && mounted.current)
        setSearchError(
          error instanceof Error && error.name !== "TypeError"
            ? error.message
            : "Search is unavailable. Check your connection and try again.",
        );
    } finally {
      if (mounted.current && searchRequest.current === request)
        setSearching(false);
    }
  }
  const title = busy
    ? "Checking ticket…"
    : outcome?.result === "VALID"
      ? "Welcome in."
      : outcome?.result === "ALREADY_USED"
        ? "Already checked in"
        : outcome?.result === "ERROR"
          ? "Result not confirmed"
          : outcome
            ? "Ticket not valid"
            : "Ready for your next guest";
  const ResultIcon =
    outcome?.result === "VALID"
      ? Check
      : outcome?.result === "ALREADY_USED" || outcome?.result === "ERROR"
        ? CircleAlert
        : outcome
          ? X
          : QrCode;
  const checkedAt = (value: string) =>
    new Intl.DateTimeFormat("en-IN", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: timezone,
    }).format(new Date(value));
  return (
    <section className="r-checkin">
      <div className="gate-intro">
        <div>
          <h2>A smooth welcome starts here.</h2>
          <p>
            Scan one ticket per guest. Only admit a guest after a green
            confirmation.
          </p>
        </div>
        <div className="gate-intro-actions">
          <button type="button" onClick={() => queryInput.current?.focus()}>
            <Search size={15} aria-hidden="true" />
            Manual lookup
          </button>
          <span className="gate-connection" data-online={online}>
            {online ? <ShieldCheck size={15} /> : <WifiOff size={15} />}
            {online ? "Connected" : "Offline"}
          </span>
        </div>
      </div>
      {!online && (
        <p className="gate-notice" role="alert">
          <WifiOff size={18} />
          You’re offline. Check-in needs a live connection; reconnect before
          admitting guests.
        </p>
      )}
      <div className="gate-grid">
        <div className="gate-camera">
          <div className="gate-video">
            <video
              ref={video}
              muted
              playsInline
              aria-label="QR camera preview"
            />
            {camera && <div className="gate-target" aria-hidden="true" />}
            {!camera && (
              <div className="gate-placeholder">
                <Camera size={36} aria-hidden="true" />
                <strong>
                  {starting ? "Opening your camera…" : "Scan a ticket QR"}
                </strong>
                <p>
                  Use the rear camera. Keep the QR steady and the screen bright.
                </p>
              </div>
            )}
            {camera && (
              <span className="gate-caption">
                {busy
                  ? "Checking…"
                  : outcome
                    ? "Paused · review result"
                    : "Hold the QR inside the frame"}
              </span>
            )}
          </div>
          <div className="gate-controls">
            <button
              type="button"
              className={!camera && !starting ? "gate-primary" : ""}
              disabled={!(camera || starting) && (busy || !online)}
              onClick={camera || starting ? stopCamera : startCamera}
            >
              {camera || starting ? (
                <CameraOff size={17} />
              ) : (
                <Camera size={17} />
              )}
              {starting
                ? "Cancel camera"
                : camera
                  ? "Stop camera"
                  : cameraError
                    ? "Retry camera"
                    : "Start camera"}
            </button>
            {torchAvailable && (
              <button
                type="button"
                aria-pressed={torch}
                onClick={async () => {
                  try {
                    await controls.current?.switchTorch?.(!torch);
                    setTorch(!torch);
                  } catch {
                    setNotice(
                      "Flashlight is unavailable. Increase the ticket screen brightness instead.",
                    );
                  }
                }}
              >
                <Flashlight size={17} />
                Light {torch ? "on" : "off"}
              </button>
            )}
            <button
              type="button"
              aria-pressed={sound}
              onClick={async () => {
                try {
                  if (!sound) {
                    audio.current ||= new AudioContext();
                    await audio.current.resume();
                  } else await audio.current?.suspend();
                  setSound(!sound);
                } catch {
                  setSound(false);
                  setNotice(
                    "Sound is unavailable. Use the on-screen result to confirm admission.",
                  );
                }
              }}
            >
              <Volume2 size={17} />
              Sound {sound ? "on" : "off"}
            </button>
          </div>
          {devices.length > 1 && (
            <label className="gate-device">
              Camera
              <select
                value={device}
                disabled={starting || busy}
                onChange={(event) => {
                  stopCamera();
                  setDevice(event.target.value);
                  setNotice("Camera changed. Press Start camera to continue.");
                }}
              >
                <option value="">Default rear camera</option>
                {devices.map((item, index) => (
                  <option value={item.deviceId} key={item.deviceId}>
                    {item.label || `Camera ${index + 1}`}
                  </option>
                ))}
              </select>
            </label>
          )}
          {cameraError && (
            <div className="gate-camera-error" role="alert">
              <CircleAlert size={18} />
              <div>
                <strong>{cameraError.title}</strong>
                <p>{cameraError.message}</p>
                <button
                  type="button"
                  onClick={() => queryInput.current?.focus()}
                >
                  Use manual lookup
                </button>
              </div>
            </div>
          )}
          {notice && (
            <p className="gate-help" role="status">
              {notice}
            </p>
          )}
          <details className="gate-scan-help">
            <summary>QR won’t scan?</summary>
            <p>
              Raise the guest’s screen brightness, move the phone slightly
              farther away and avoid glare. You can use a USB scanner or paste
              the ticket QR link below.
            </p>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void submit({ token: token.trim() });
              }}
            >
              <label htmlFor={`${id}-token`}>
                Ticket QR link or signed code
              </label>
              <div className="gate-input-row">
                <input
                  id={`${id}-token`}
                  value={token}
                  maxLength={4096}
                  required
                  onChange={(event) => setToken(event.target.value)}
                  autoComplete="off"
                  placeholder="Paste the ticket’s QR link"
                />
                <button disabled={busy || !online || !token.trim()}>
                  Check ticket
                </button>
              </div>
            </form>
          </details>
        </div>
        <div
          className="gate-result"
          data-result={busy ? "CHECKING" : outcome?.result || "READY"}
          role="status"
          aria-live="polite"
          aria-atomic="true"
          aria-busy={busy}
        >
          <span className="gate-eyebrow">ENTRY CHECK</span>
          <div className="gate-result-icon">
            <ResultIcon size={30} aria-hidden="true" />
          </div>
          <h2 ref={resultHeading} tabIndex={-1}>
            {title}
          </h2>
          <p>
            {busy
              ? "Confirming this ticket with the server. Please wait."
              : outcome?.reason ||
                "Start the camera or find a guest manually. Each ticket admits one person."}
          </p>
          {outcome?.ticket && (
            <div className="gate-ticket">
              <strong>{outcome.ticket.holderName}</strong>
              <span>{outcome.ticket.ticketType.name}</span>
              <code>{outcome.ticket.code}</code>
              {outcome.ticket.checkedInAt && (
                <small>
                  {outcome.result === "ALREADY_USED"
                    ? "First entry"
                    : "Admitted"}
                  : {checkedAt(outcome.ticket.checkedInAt)}
                  <br />
                  By {outcome.ticket.checkedInBy?.name || "Entry staff"}
                </small>
              )}
            </div>
          )}
          {outcome && (
            <div className="gate-result-actions">
              {outcome.result === "ERROR" && (
                <button
                  type="button"
                  className="gate-primary"
                  disabled={busy || !online}
                  onClick={() =>
                    lastInput.current && void submit(lastInput.current)
                  }
                >
                  Retry this ticket
                </button>
              )}
              <button type="button" disabled={busy} onClick={reset}>
                {camera ? "Scan next guest" : "Check next guest"}
              </button>
            </div>
          )}
        </div>
      </div>
      <section className="gate-manual" aria-labelledby={`${id}-manual`}>
        <div>
          <h2 id={`${id}-manual`}>
            <Search size={18} aria-hidden="true" />
            Find a guest
          </h2>
          <p>
            Search name, email, mobile, ticket code or full booking ID. Review
            the matching ticket before checking in.
          </p>
        </div>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void search();
          }}
          className="gate-search"
        >
          <label className="gate-sr" htmlFor={`${id}-search`}>
            Find an attendee manually
          </label>
          <div className="gate-input-row">
            <input
              ref={queryInput}
              id={`${id}-search`}
              value={query}
              minLength={2}
              maxLength={100}
              required
              autoComplete="off"
              onChange={(event) => {
                clearSearch();
                setQuery(event.target.value);
              }}
              placeholder="Name, email, mobile or ticket code"
            />
            <button className="gate-primary" disabled={searching || !online}>
              <Search size={16} />
              {searching ? "Searching…" : "Find guest"}
            </button>
          </div>
        </form>
        {searchError && (
          <p className="gate-notice" role="alert">
            {searchError}
          </p>
        )}
        {searching && (
          <p role="status" className="gate-help">
            Finding matching tickets…
          </p>
        )}
        {searched && !results.length && (
          <div className="gate-search-empty" role="status">
            <strong>No matching tickets</strong>
            <p>
              Check the spelling or try the ticket code. Make sure the guest is
              at the correct event.
            </p>
          </div>
        )}
        {searched && results.length > 0 && (
          <>
            <p className="gate-help" role="status">
              {results.length === 50
                ? "Showing the first 50 matches. Narrow the search to find a specific guest."
                : `${results.length} matching ticket${results.length === 1 ? "" : "s"}`}
            </p>
            <ul className="gate-attendees">
              {results.map((ticket) => {
                const eligible =
                  ticket.status === "VALID" && ticket.order.status === "PAID";
                const used =
                  ticket.status === "USED" && ticket.order.status === "PAID";
                return (
                  <li key={ticket.id}>
                    <div>
                      <strong>{ticket.holderName}</strong>
                      <p>
                        {ticket.ticketType.name} · <code>{ticket.code}</code>
                      </p>
                      <small>
                        {ticket.holderEmail}
                        {ticket.holderPhone &&
                          ` · •••• ${ticket.holderPhone.slice(-4)}`}
                      </small>
                      <span
                        className="gate-ticket-status"
                        data-valid={eligible}
                      >
                        {used
                          ? "Already checked in"
                          : eligible
                            ? "Ready for entry"
                            : ticket.order.status !== "PAID"
                              ? `Booking ${ticket.order.status.toLowerCase()}`
                              : `Ticket ${ticket.status.toLowerCase()}`}
                        {used &&
                          ticket.checkedInAt &&
                          ` · ${checkedAt(ticket.checkedInAt)}`}
                      </span>
                    </div>
                    <button
                      type="button"
                      disabled={busy || !eligible || !online}
                      aria-label={`Check in ${ticket.holderName}, ticket ${ticket.code}`}
                      onClick={() => void submit({ ticketId: ticket.id })}
                    >
                      <Check size={16} />
                      {used
                        ? "Admitted"
                        : eligible
                          ? "Check in"
                          : "Unavailable"}
                    </button>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </section>
    </section>
  );
}
