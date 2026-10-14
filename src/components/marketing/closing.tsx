"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { animate, useInView } from "motion/react";
import { marketing } from "@/config/marketing";
import {
  firstEventLabel,
  pricing,
  rupees,
  standardFeeLabel,
} from "@/config/pricing";
import { Reveal, Magnetic } from "@/lib/motion/primitives";
import { useReducedMotion } from "@/lib/motion/reduced";
import { Perforation, Stamp, Sticker, TicketShell } from "./motifs";

function FreePrice() {
  const ref = useRef<HTMLSpanElement>(null);
  const visible = useInView(ref, { once: true });
  const reduced = useReducedMotion();
  const [digit, setDigit] = useState(pricing.firstEvent.platformFeePaise / 100);
  useEffect(() => {
    if (
      !matchMedia(
        "(min-width: 768px) and (prefers-reduced-motion: no-preference)",
      ).matches
    )
      return;
    if (!visible || reduced) return;
    const control = animate(9, pricing.firstEvent.platformFeePaise / 100, {
      duration: 0.7,
      ease: "easeOut",
      onUpdate: (value) => setDigit(Math.round(value)),
    });
    return () => control.stop();
  }, [visible, reduced]);
  return (
    <span ref={ref}>
      <span className="sr-only">
        {rupees(pricing.firstEvent.platformFeePaise)}
      </span>
      <span aria-hidden="true">₹{digit}</span>
    </span>
  );
}
export function PricingAndFaq() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <>
      <section id="pricing" className="m-pricing m-section">
        <div className="m-container">
          <Reveal className="m-pricing-title">
            <p className="m-eyebrow">
              Start with a good idea. Keep your wallet closed.
            </p>
            <h2 className="m-heading">
              Free to host
              <br />
              <em className="m-serif">your first event.</em>
            </h2>
          </Reveal>
          <div className="m-pricing-grid">
            <Reveal>
              <TicketShell
                className="m-first-price"
                stub={
                  <div className="m-pricing-stub">
                    <span className="m-mono">
                      ONE GREAT IDEA. ZERO PLATFORM FEE.
                    </span>
                    <span>↗</span>
                  </div>
                }
              >
                <div className="m-pricing-body">
                  <div className="m-price-top">
                    <span className="m-mono">YOUR FIRST EVENT</span>
                    <Sticker>ON THE HOUSE</Sticker>
                  </div>
                  <div className="m-price-number">
                    <FreePrice />
                    <span>platform fee</span>
                  </div>
                  <h3>{firstEventLabel()}.</h3>
                  <p>
                    No setup fee. No monthly fee.
                    <br />
                    Every feature included.
                  </p>
                  <ul>
                    <li>✓ Unlimited ticket types</li>
                    <li>✓ Email + WhatsApp updates</li>
                    <li>✓ QR check-in & your whole crew</li>
                  </ul>
                  <Link href={marketing.primaryCta.href} className="m-button">
                    {marketing.primaryCta.label} ↗
                  </Link>
                  <Stamp className="m-price-stamp" />
                </div>
              </TicketShell>
            </Reveal>
            <Reveal delay={0.1} className="m-standard-price">
              <span className="m-mono">AFTER THAT</span>
              <h3>
                Pay as
                <br />
                you <em className="m-serif">grow.</em>
              </h3>
              <p className="m-standard-fee">{standardFeeLabel()}</p>
              <Perforation />
              <p>
                A small fee when you sell a paid ticket.
                <br />
                Free tickets always stay free.
              </p>
              <p className="m-price-detail">
                Keep it simple: no subscription, no minimum sales, no monthly
                commitment.
              </p>
              <Link href={marketing.primaryCta.href} className="m-text-link">
                Let’s get your first one going <span>↗</span>
              </Link>
            </Reveal>
          </div>
          <p className="m-pricing-footnote">
            Payment gateway (Cashfree) processing charges apply on paid tickets.
          </p>
        </div>
      </section>
      <section className="m-trust">
        <div className="m-container">
          <p className="m-eyebrow">Small details. Big difference.</p>
          <div className="m-trust-grid">
            {[
              "QR delivered in seconds",
              "Double-scan protection",
              "Works on any phone",
              "Your data stays yours",
            ].map((fact, index) => (
              <Reveal key={fact} delay={index * 0.06}>
                <span className="m-trust-check">✓</span>
                <h3>{fact}</h3>
              </Reveal>
            ))}
          </div>
          {/* Real organizer testimonials can be added here when permission and verified quotes are available. */}
        </div>
      </section>
      <section id="faq" className="m-faq m-section">
        <div className="m-container m-faq-grid">
          <Reveal>
            <p className="m-eyebrow">The small print, in big enough type</p>
            <h2 className="m-heading">
              Good
              <br />
              <em className="m-serif">questions.</em>
            </h2>
            <p className="m-lead">A few things you might be wondering.</p>
            <span className="m-faq-doodle" aria-hidden="true">
              ↳
            </span>
          </Reveal>
          <div className="m-accordion">
            {marketing.faq.map((item, index) => (
              <div
                className={`m-faq-item ${open === index ? "is-open" : ""}`}
                key={item.question}
              >
                <h3>
                  <button
                    id={`faq-button-${index}`}
                    aria-expanded={open === index}
                    aria-controls={`faq-answer-${index}`}
                    onClick={() => setOpen(open === index ? null : index)}
                  >
                    <span className="m-mono">0{index + 1}</span>
                    {item.question}
                    <span className="m-faq-plus" aria-hidden="true">
                      {open === index ? "−" : "+"}
                    </span>
                  </button>
                </h3>
                <div
                  id={`faq-answer-${index}`}
                  role="region"
                  aria-labelledby={`faq-button-${index}`}
                  className="m-faq-answer"
                  inert={open !== index}
                >
                  <div>
                    <p>{item.answer}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
      <FinalCta />
    </>
  );
}
function FinalCta() {
  const ref = useRef<HTMLElement>(null);
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
        if (cancelled || !ref.current) return;
        gsap.registerPlugin(ScrollTrigger);
        const media = gsap.matchMedia();
        media.add(
          "(min-width: 768px) and (prefers-reduced-motion: no-preference)",
          () => {
            const stub = ref.current?.querySelector(".m-ticket-stub");
            if (stub)
              gsap.to(stub, {
                x: 85,
                y: 55,
                rotation: 7,
                opacity: 0.1,
                scrollTrigger: {
                  trigger: ref.current,
                  start: "top 30%",
                  end: "bottom 10%",
                  scrub: true,
                },
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
    <section className="m-final-section" ref={ref}>
      <div className="m-container">
        <Reveal>
          <TicketShell
            className="m-final-ticket"
            stub={
              <div className="m-final-stub">
                <span className="m-mono">ADMIT ONE GREAT IDEA</span>
                <span className="m-serif">See you at the door.</span>
              </div>
            }
          >
            <div className="m-final-body">
              <span className="m-mono">THIS IS YOUR INVITATION</span>
              <h2>
                Your first event
                <br />
                is <em className="m-serif">free to host.</em>
              </h2>
              <Magnetic>
                <Link href={marketing.primaryCta.href} className="m-button">
                  {marketing.primaryCta.label} ↗
                </Link>
              </Magnetic>
              <p>Takes about ten minutes. No card needed.</p>
              <span className="m-final-star" aria-hidden="true">
                ✳
              </span>
            </div>
          </TicketShell>
        </Reveal>
      </div>
    </section>
  );
}
