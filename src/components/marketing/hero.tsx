import Link from "next/link";
import { marketing } from "@/config/marketing";
import { Magnetic } from "@/lib/motion/primitives";
import { SplitWords } from "./split-words";
import { HeroTicket } from "./hero-ticket";

export function Hero() {
  return (
    <section className="m-hero m-container" aria-labelledby="hero-title">
      <div className="m-hero-copy">
        <div className="m-hero-eyebrow">
          <span className="m-pulse" />
          <span>{marketing.hero.eyebrow}</span>
        </div>
        <h1 id="hero-title">
          <SplitWords>Throw the event.</SplitWords>
          <br />
          <SplitWords>We&apos;ll handle the</SplitWords>
          <em className="m-serif"> door.</em>
        </h1>
        <p className="m-hero-subhead">{marketing.hero.subhead}</p>
        <div className="m-hero-actions">
          <Magnetic>
            <Link href={marketing.primaryCta.href} className="m-button">
              {marketing.primaryCta.label}
              <span aria-hidden="true">↗</span>
            </Link>
          </Magnetic>
          <Link
            href={marketing.secondaryCta.href}
            className="m-button m-button-secondary"
          >
            {marketing.secondaryCta.label}
            <span aria-hidden="true">→</span>
          </Link>
        </div>
        <p className="m-hero-micro">{marketing.hero.micro}</p>
      </div>
      <HeroTicket />
      <div className="m-scroll-cue" aria-hidden="true">
        <span>SCROLL TO EXPLORE</span>
        <i>↓</i>
      </div>
    </section>
  );
}
