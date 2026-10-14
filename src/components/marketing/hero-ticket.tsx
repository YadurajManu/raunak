"use client";
import { APP_NAME } from "@/lib/constants";
import { useEffect, useRef } from "react";
import { FakeQR, Sticker, TicketShell } from "./motifs";
import { Tilt } from "@/lib/motion/primitives";

export function HeroTicket() {
  const stage = useRef<HTMLDivElement>(null);
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
      ([module, trigger]) => {
        if (cancelled || !stage.current) return;
        const gsap = module.gsap;
        gsap.registerPlugin(trigger.ScrollTrigger);
        const media = gsap.matchMedia();
        media.add(
          "(min-width: 768px) and (prefers-reduced-motion: no-preference)",
          () => {
            const stub = stage.current?.querySelector(".m-ticket-stub");
            const ticket = stage.current?.querySelector(".m-demo-ticket");
            if (!stage.current || !stub || !ticket) return;
            const timeline = gsap.timeline({
              scrollTrigger: {
                trigger: stage.current,
                start: "center 56%",
                end: "bottom top",
                scrub: true,
              },
            });
            timeline
              .to(
                stub,
                { y: 130, x: 90, rotation: 24, opacity: 0, ease: "none" },
                0,
              )
              .to(ticket, { y: -80, scale: 0.92, ease: "none" }, 0);
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
    <div
      className="m-hero-stage"
      ref={stage}
      aria-label="Illustration of a fictional event ticket"
    >
      <div className="m-hero-sun" aria-hidden="true" />
      <div className="m-hero-dots" aria-hidden="true" />
      <Sticker className="m-sticker-one">₹0 to start</Sticker>
      <Sticker className="m-sticker-two">UPI ✓</Sticker>
      <Sticker className="m-sticker-three">QR in 2 sec</Sticker>
      <Sticker className="m-sticker-four">WhatsApp ✓</Sticker>
      <Tilt className="m-ticket-tilt">
        <TicketShell
          className="m-demo-ticket"
          stub={
            <div className="m-demo-stub">
              <div>
                <p className="m-mono">Admit one</p>
                <strong>NO. 0042</strong>
                <p className="m-mono">Fictional preview</p>
              </div>
              <FakeQR size={84} />
            </div>
          }
        >
          <div className="m-demo-poster" aria-hidden="true">
            <div className="m-poster-sun" />
            <div className="m-poster-horizon" />
            <div className="m-poster-grain" />
            <span className="m-poster-top m-mono">
              {APP_NAME.toUpperCase()} PRESENTS · SAMPLE EVENT
            </span>
            <span className="m-poster-number m-mono">SS / 003</span>
          </div>
          <div className="m-demo-details">
            <span className="m-mono">Live music · Fictional demo</span>
            <h2>
              Sunset
              <br />
              <em className="m-serif">Sessions</em>
              <small>Vol. 3</small>
            </h2>
            <div className="m-demo-rule" aria-hidden="true" />
            <div className="m-demo-meta">
              <span>
                <b>SAT 14 NOV</b>
                <small>7 PM ONWARDS</small>
              </span>
              <span>
                <b>ROOFTOP DECK</b>
                <small>ADMIT ONE · GENERAL</small>
              </span>
            </div>
          </div>
        </TicketShell>
      </Tilt>
    </div>
  );
}
