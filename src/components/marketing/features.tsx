"use client";
import { useEffect, useRef, useState } from "react";
import { animate, useInView } from "motion/react";
import { Reveal } from "@/lib/motion/primitives";
import { useReducedMotion } from "@/lib/motion/reduced";
import { FakeQR, Sticker } from "./motifs";
import { rupees } from "@/config/pricing";

function DemoTile({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLElement>(null);
  const visible = useInView(ref, { once: true, amount: 0.25 });
  return (
    <article
      ref={ref}
      className={`m-feature-tile ${className} ${visible ? "is-visible" : ""}`}
    >
      {children}
    </article>
  );
}
function Revenue() {
  const ref = useRef<HTMLSpanElement>(null);
  const visible = useInView(ref, { once: true });
  const reduced = useReducedMotion();
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!visible) return;
    const control = animate(0, 18600000, {
      duration: reduced ? 0 : 1.5,
      ease: "easeOut",
      onUpdate: (value) => setValue(Math.round(value)),
    });
    return () => control.stop();
  }, [visible, reduced]);
  return <span ref={ref}>{rupees(reduced ? 18600000 : value)}</span>;
}
export function Features() {
  const [assigned, setAssigned] = useState(false);
  return (
    <section id="features" className="m-features m-section">
      <div className="m-container">
        <Reveal className="m-section-intro">
          <div>
            <p className="m-eyebrow">A little less admin. A lot more event.</p>
            <h2 className="m-heading">
              The whole show.
              <br />
              <em className="m-serif">One calm dashboard.</em>
            </h2>
          </div>
          <p className="m-lead">
            From the first ticket to the last person through the door. All the
            moving parts, in one place.
          </p>
        </Reveal>
        <div className="m-bento">
          <DemoTile className="m-tile-payments">
            <div className="m-tile-label m-mono">01 / COLLECT</div>
            <h3>
              Payments that
              <br />
              <em className="m-serif">just work.</em>
            </h3>
            <p>
              UPI, cards, netbanking and wallets.
              <br />
              Let people pay their way.
            </p>
            <div className="m-payment-demo">
              <div className="m-payment-demo-top">
                <span>Sunset Sessions</span>
                <small>SAMPLE CHECKOUT</small>
              </div>
              <div className="m-pay-amount">
                ₹499<span>General admission</span>
              </div>
              <div className="m-payment-chips">
                <span className="is-selected">
                  UPI <b>✓</b>
                </span>
                <span>Card</span>
                <span>Netbanking</span>
                <span>Wallets</span>
              </div>
              <div className="m-paid-stamp">
                PAID ₹499 <span>✓</span>
              </div>
            </div>
          </DemoTile>
          <DemoTile className="m-tile-whatsapp">
            <div className="m-tile-label m-mono">02 / KEEP IN TOUCH</div>
            <h3>
              WhatsApp,
              <br />
              <em className="m-serif">on autopilot.</em>
            </h3>
            <p>The right message. At the right moment.</p>
            <div className="m-feature-chat">
              <div className="m-mini-bubble">
                You’re in! Your order is confirmed. <small>✓✓</small>
              </div>
              <div className="m-mini-bubble">
                One ticket. One great evening. 🎟 <small>✓✓</small>
              </div>
              <div className="m-mini-bubble">
                Tomorrow’s the day. See you at 7! <small>✓✓</small>
              </div>
            </div>
          </DemoTile>
          <DemoTile className="m-tile-qr">
            <div className="m-tile-label m-mono">03 / ADMIT</div>
            <h3>
              QR tickets.
              <br />
              No app needed.
            </h3>
            <div className="m-feature-qr">
              <FakeQR size={108} />
              <span />
              <b>✓ You’re good to go</b>
            </div>
          </DemoTile>
          <DemoTile className="m-tile-team">
            <div className="m-tile-label m-mono">04 / BRING YOUR CREW</div>
            <h3>
              Your whole crew.
              <br />
              One dashboard.
            </h3>
            <div className="m-avatar-stack">
              <span>AS</span>
              <span>RK</span>
              <button
                draggable
                onDragStart={(event) =>
                  event.dataTransfer.setData("text/plain", "crew")
                }
                onClick={() => setAssigned(!assigned)}
                aria-label={
                  assigned
                    ? "RM — Unassign Rohan from event"
                    : "RM — Assign Rohan to event"
                }
              >
                RM
              </button>
            </div>
            <div
              className={`m-assign-drop ${assigned ? "is-assigned" : ""}`}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                if (event.dataTransfer.getData("text/plain") === "crew")
                  setAssigned(true);
              }}
            >
              <span>Sunset Sessions</span>
              <small>
                {assigned
                  ? "Rohan assigned · Check-in ✓"
                  : "Drag or tap RM to assign"}
              </small>
            </div>
          </DemoTile>
          <DemoTile className="m-tile-posters">
            <div className="m-tile-label m-mono">05 / SET THE SCENE</div>
            <h3>
              Posters that
              <br />
              <em className="m-serif">look good.</em>
            </h3>
            <div className="m-poster-fan" aria-hidden="true">
              <div>
                <span>
                  MAKE
                  <br />
                  SOME
                  <br />
                  NOISE.
                </span>
              </div>
              <div>
                <span>
                  AFTER
                  <br />
                  <em>hours.</em>
                </span>
              </div>
              <div>
                <span>
                  Sunset
                  <br />
                  <em>Sessions.</em>
                </span>
              </div>
            </div>
            <p className="m-file-formats m-mono">
              JPG · PNG · WebP · AVIF · HEIC
            </p>
          </DemoTile>
          <DemoTile className="m-tile-analytics">
            <div>
              <div className="m-tile-label m-mono">06 / KNOW YOUR NUMBERS</div>
              <h3>
                See it <em className="m-serif">sell.</em>
              </h3>
              <p>
                Revenue, ticket sales and check-ins.
                <br />A clear view of how your event is doing.
              </p>
            </div>
            <div className="m-chart-demo">
              <div className="m-chart-top">
                <div>
                  <small>GROSS REVENUE · SAMPLE DATA</small>
                  <strong>
                    <Revenue />
                  </strong>
                </div>
                <Sticker>Looking good ↗</Sticker>
              </div>
              <svg
                viewBox="0 0 600 130"
                role="img"
                aria-label="Illustrative sample sales chart trending upward"
              >
                <path
                  d="M0 120H600M0 70H600M0 20H600"
                  stroke="currentColor"
                  opacity=".12"
                  fill="none"
                />
                <path
                  className="m-chart-fill"
                  d="M0 118L50 108L95 110L140 88L180 95L225 65L270 72L315 40L360 48L405 24L450 30L500 10L550 20L600 2V130H0Z"
                  fill="currentColor"
                  opacity=".12"
                />
                <path
                  className="m-chart-line"
                  d="M0 118L50 108L95 110L140 88L180 95L225 65L270 72L315 40L360 48L405 24L450 30L500 10L550 20L600 2"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                />
              </svg>
              <div className="m-chart-axis m-mono">
                <span>MON</span>
                <span>TUE</span>
                <span>WED</span>
                <span>THU</span>
                <span>FRI</span>
                <span>SAT</span>
                <span>SUN</span>
              </div>
            </div>
          </DemoTile>
        </div>
      </div>
    </section>
  );
}
export function MessageCustomizer() {
  const [note, setNote] = useState("Gates open at 6. Bring this QR!");
  const [enabled, setEnabled] = useState([true, true, false]);
  const labels = ["Order confirmed", "24h reminder", "2h reminder"];
  return (
    <section className="m-customizer m-section">
      <div className="m-container m-customizer-grid">
        <Reveal>
          <p className="m-eyebrow">Make it sound like you</p>
          <h2 className="m-heading">
            Your words.
            <br />
            Delivered on
            <br />
            <em className="m-serif">WhatsApp.</em>
          </h2>
          <p className="m-lead">A warm welcome beats a robotic receipt.</p>
          <div className="m-message-editor">
            <label htmlFor="custom-note">
              Your custom note <span>TRY IT ↓</span>
            </label>
            <textarea
              id="custom-note"
              value={note}
              maxLength={180}
              onChange={(event) => setNote(event.target.value)}
              rows={3}
            />
            <div className="m-character-count m-mono">{note.length} / 180</div>
            <div className="m-message-toggles">
              {labels.map((label, index) => (
                <label key={label}>
                  <span>{label}</span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={enabled[index]}
                    aria-label={label}
                    className={enabled[index] ? "is-on" : ""}
                    onClick={() =>
                      setEnabled(
                        enabled.map((value, i) =>
                          i === index ? !value : value,
                        ),
                      )
                    }
                  >
                    <span />
                  </button>
                </label>
              ))}
            </div>
          </div>
          <p className="m-customizer-caption">
            Edit messages any time from your dashboard.
          </p>
        </Reveal>
        <Reveal className="m-customizer-preview">
          <div className="m-phone">
            <div className="m-phone-screen screen-2">
              <div className="m-phone-status">
                <span>9:41</span>
                <span>▰ ▰ ▰</span>
              </div>
              <div className="m-chat-header">
                <span className="m-chat-avatar">R</span>
                <div>
                  <b>Sunset Sessions</b>
                  <small>Event updates · Demo preview</small>
                </div>
              </div>
              <div className="m-chat-body">
                <span className="m-chat-date">TODAY</span>
                {enabled[0] && (
                  <div className="m-chat-bubble">
                    Hey Aditi! Your ticket is confirmed. 🎟
                    <div className="m-chat-ticket">
                      <FakeQR size={86} />
                      <b>Sunset Sessions · General</b>
                    </div>
                    <small>9:41 AM ✓✓</small>
                  </div>
                )}
                <div className="m-chat-bubble m-live-note" aria-live="polite">
                  {note || "Your custom note appears here."}
                  <small>9:41 AM ✓✓</small>
                </div>
                {enabled[1] && (
                  <div className="m-chat-bubble">
                    One day to go! We can’t wait to see you.
                    <small>24H REMINDER · DEMO</small>
                  </div>
                )}
                {enabled[2] && (
                  <div className="m-chat-bubble">
                    Doors open in two hours. Your QR is ready.
                    <small>2H REMINDER · DEMO</small>
                  </div>
                )}
              </div>
              <div className="m-phone-home" />
            </div>
          </div>
          <span className="m-customizer-arrow m-serif">
            Go on. Make it yours. ↗
          </span>
        </Reveal>
      </div>
    </section>
  );
}
