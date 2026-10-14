import { notFound } from "next/navigation";
import {
  FakeQR,
  Perforation,
  Stamp,
  Sticker,
  TicketShell,
} from "@/components/marketing/motifs";
export default function StyleGuide() {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <main className="m-container m-section">
      <p className="m-eyebrow">Internal style guide</p>
      <h1 className="m-heading">
        Paper. Ink. <em className="m-serif">Tickets.</em>
      </h1>
      <div
        style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBlock: 36 }}
      >
        {["paper", "paper-2", "ink", "muted", "accent", "sun", "ok"].map(
          (token) => (
            <div key={token} style={{ width: 120 }}>
              <div
                style={{
                  width: 120,
                  height: 80,
                  border: "1px solid var(--line)",
                  borderRadius: 12,
                  background: `var(--${token})`,
                }}
              />
              <span className="m-mono">{token}</span>
            </div>
          ),
        )}
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 24,
          flexWrap: "wrap",
        }}
      >
        <a className="m-button" href="/signup?intent=organizer">
          Host your first event — free
        </a>
        <Sticker>₹0 to start</Sticker>
        <Stamp />
        <FakeQR />
      </div>
      <TicketShell
        className="mt-10 max-w-sm"
        stub={<div className="p-8 m-mono">ADMIT ONE · NO. 0042</div>}
      >
        <div className="p-8">
          <h2 className="text-3xl">Sunset Sessions</h2>
          <p className="mt-4 m-mono">SAT 14 NOV · 7 PM</p>
          <Perforation className="mt-10" />
        </div>
      </TicketShell>
    </main>
  );
}
