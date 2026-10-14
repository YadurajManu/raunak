"use client";
import { useEffect, useRef, useState } from "react";
import { marketing } from "@/config/marketing";
import { FakeQR, Marquee } from "./motifs";
import { Reveal } from "@/lib/motion/primitives";

export function PhoneScreen({ step }: { step: number }) {
  return (
    <div className={`m-phone-screen screen-${step}`}>
      <div className="m-phone-status">
        <span>9:41</span>
        <span>▰ ▰ ▰</span>
      </div>
      {step === 0 ? (
        <>
          <div className="m-phone-appbar">
            Your next great event <span>•••</span>
          </div>
          <div className="m-editor-poster">
            <span>
              Sunset
              <br />
              <em>Sessions.</em>
            </span>
            <small>FICTIONAL DEMO</small>
          </div>
          <div className="m-field-demo">
            <small>EVENT NAME</small>
            <b>Sunset Sessions Vol. 3</b>
          </div>
          <div className="m-field-demo">
            <small>DATE & TIME</small>
            <b>Sat, 14 Nov · 7:00 PM</b>
          </div>
          <div className="m-phone-ticket-row">
            <span>General admission</span>
            <b>₹499</b>
          </div>
          <div className="m-phone-ticket-row">
            <span>VIP rooftop</span>
            <b>₹999</b>
          </div>
          <div className="m-phone-button">Publish event ↗</div>
        </>
      ) : step === 1 ? (
        <>
          <div className="m-phone-appbar">You’re on the list.</div>
          <div className="m-checkout-mini">
            <small>Sunset Sessions · Sample checkout</small>
            <h4>
              One good evening.
              <br />
              One little ticket.
            </h4>
            <div className="m-phone-ticket-row">
              <span>General × 1</span>
              <b>₹499</b>
            </div>
            <p className="m-mono">PAY YOUR WAY</p>
            <div className="m-payment-options">
              <b>UPI</b>
              <span>Card</span>
              <span>Netbanking</span>
            </div>
            <div className="m-payment-success">
              <span>✓</span>
              <b>Payment received</b>
              <small>See you at sunset.</small>
            </div>
          </div>
        </>
      ) : step === 2 ? (
        <>
          <div className="m-chat-header">
            <span className="m-chat-avatar">R</span>
            <div>
              <b>Sunset Sessions</b>
              <small>Event updates · Demo</small>
            </div>
            <span>⋮</span>
          </div>
          <div className="m-chat-body">
            <span className="m-chat-date">TODAY</span>
            <div className="m-chat-bubble">
              Hey Aditi! You’re in. 🎟
              <br />
              Your evening just got better.
              <div className="m-chat-ticket">
                <FakeQR size={104} />
                <b>General admission</b>
                <small>Sat 14 Nov · 7 PM</small>
              </div>
              <small>6:02 PM ✓✓</small>
            </div>
            <div className="m-chat-bubble">
              Gates open at 6. Bring this QR!<small>6:02 PM ✓✓</small>
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="m-phone-appbar">
            Welcome crew <span>○ LIVE</span>
          </div>
          <div className="m-scan-frame">
            <FakeQR size={142} />
            <span className="m-scan-line" />
          </div>
          <div className="m-valid-state">
            <span>✓</span>
            <h4>Valid. Welcome!</h4>
            <p>Aditi Sharma</p>
            <small>GENERAL · NO. 0042 · DEMO</small>
          </div>
          <div className="m-scan-footer">
            One scan. One entry. No confusion.
          </div>
        </>
      )}
      <div className="m-phone-home" />
    </div>
  );
}
export function Story() {
  const section = useRef<HTMLElement>(null);
  const [step, setStep] = useState(0);
  useEffect(() => {
    if (
      !matchMedia(
        "(min-width: 768px) and (prefers-reduced-motion: no-preference)",
      ).matches
    )
      return;
    let cancelled = false;
    let cleanup: (() => void) | undefined;
    Promise.all([import("gsap"), import("gsap/ScrollTrigger")]).then(
      ([{ gsap }, { ScrollTrigger }]) => {
        if (cancelled || !section.current) return;
        gsap.registerPlugin(ScrollTrigger);
        const media = gsap.matchMedia();
        media.add(
          "(min-width: 768px) and (prefers-reduced-motion: no-preference)",
          () => {
            ScrollTrigger.create({
              trigger: section.current,
              start: "top top",
              end: "+=2200",
              pin: true,
              onUpdate: (self) =>
                setStep(Math.min(3, Math.floor(self.progress * 4))),
            });
          },
        );
        cleanup = () => media.revert();
      },
    );
    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, []);
  return (
    <>
      <Marquee items={marketing.eventTypes} />
      <section id="how-it-works" className="m-story" ref={section}>
        <div className="m-container m-story-grid">
          <div className="m-story-copy">
            <p className="m-eyebrow">From idea to full house</p>
            <h2 className="m-heading">
              Four steps.
              <br />
              <em className="m-serif">One great night.</em>
            </h2>
            <div className="m-story-steps">
              {marketing.steps.map((item, index) => (
                <button
                  key={item.number}
                  className={step === index ? "is-active" : ""}
                  onClick={() => setStep(index)}
                  aria-pressed={step === index}
                >
                  <span className="m-step-number">{item.number}</span>
                  <span>
                    <strong>{item.title}</strong>
                    <span className="m-step-copy">{item.copy}</span>
                  </span>
                </button>
              ))}
            </div>
            <p className="m-demo-caption">FICTIONAL EVENT · PRODUCT PREVIEW</p>
          </div>
          <div className="m-story-visual">
            <div className="m-story-orbit" />
            <div className="m-phone">
              <PhoneScreen step={step} />
            </div>
            <span className="m-story-tag m-mono">
              {marketing.steps[step].number} / 04 —{" "}
              {marketing.steps[step].screen}
            </span>
          </div>
        </div>
      </section>
      <div className="m-story-mobile m-container">
        {marketing.steps.map((item, index) => (
          <Reveal className="m-mobile-step" key={item.number}>
            <p className="m-eyebrow">Step {item.number}</p>
            <h3>{item.title}</h3>
            <p>{item.copy}</p>
            <div className="m-phone">
              <PhoneScreen step={index} />
            </div>
          </Reveal>
        ))}
      </div>
    </>
  );
}
