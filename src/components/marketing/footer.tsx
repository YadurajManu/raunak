"use client";
import {
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { APP_NAME } from "@/lib/constants";
import { marketing } from "@/config/marketing";
import { useReducedMotion } from "@/lib/motion/reduced";
import { Sun } from "lucide-react";
import { revealTheme } from "@/lib/motion/theme-reveal";

function subscribeTheme(callback: () => void) {
  const query = matchMedia("(prefers-color-scheme: dark)");
  window.addEventListener("raunak-theme", callback);
  query.addEventListener("change", callback);
  return () => {
    window.removeEventListener("raunak-theme", callback);
    query.removeEventListener("change", callback);
  };
}
function darkTheme() {
  return (
    document.documentElement.dataset.marketingTheme === "dark" ||
    (!document.documentElement.dataset.marketingTheme &&
      matchMedia("(prefers-color-scheme: dark)").matches)
  );
}
export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const dark = useSyncExternalStore(subscribeTheme, darkTheme, () => false);
  const eclipseMask = useId();
  return (
    <button
      type="button"
      className={compact ? "gnav-theme" : "m-theme-toggle m-sticker"}
      aria-label={dark ? "Use light theme" : "Use dark theme"}
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        // Focusing a sticky header must not scroll before the reveal is captured.
        event.preventDefault();
        event.currentTarget.focus({ preventScroll: true });
      }}
      onClick={(event) =>
        void revealTheme(event.currentTarget, dark ? "light" : "dark")
      }
    >
      <span
        className="theme-reveal-icon"
        data-theme={dark ? "dark" : "light"}
        aria-hidden="true"
      >
        <Sun className="theme-eclipse-rays" size={18} strokeWidth={1.7} />
        <svg
          className="theme-eclipse-disc"
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="currentColor"
          focusable="false"
        >
          <defs>
            <mask
              id={eclipseMask}
              maskUnits="userSpaceOnUse"
              x="0"
              y="0"
              width="24"
              height="24"
            >
              <rect width="24" height="24" fill="white" />
              <circle
                className="theme-eclipse-shadow"
                cx="12"
                cy="12"
                r="7"
                fill="black"
              />
            </mask>
          </defs>
          <circle cx="12" cy="12" r="6" mask={`url(#${eclipseMask})`} />
        </svg>
      </span>
      {!compact && <span>{dark ? "LIGHT" : "DARK"}</span>}
    </button>
  );
}
export function MarketingFooter() {
  const [clock, setClock] = useState("--:--");
  const canvas = useRef<HTMLCanvasElement>(null);
  const frame = useRef(0);
  const reduced = useReducedMotion();
  useEffect(() => {
    console.info(
      `┌──────────────────────────┐\n│  ${APP_NAME} · ADMIT ONE IDEA  │\n└──────────────────────────┘`,
    );
    const tick = () =>
      setClock(
        new Intl.DateTimeFormat("en-IN", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
          timeZone: "Asia/Kolkata",
        }).format(new Date()),
      );
    const initial = requestAnimationFrame(tick);
    const timer = setInterval(tick, 60000);
    return () => {
      cancelAnimationFrame(initial);
      clearInterval(timer);
      cancelAnimationFrame(frame.current);
    };
  }, []);
  function celebrate(event: React.MouseEvent<HTMLButtonElement>) {
    if (reduced || !canvas.current) return;
    const element = canvas.current;
    const context = element.getContext("2d");
    if (!context) return;
    cancelAnimationFrame(frame.current);
    const width = window.innerWidth;
    const height = window.innerHeight;
    const ratio = Math.min(devicePixelRatio, 2);
    element.width = width * ratio;
    element.height = height * ratio;
    context.scale(ratio, ratio);
    const box = event.currentTarget.getBoundingClientRect();
    const originX = event.detail ? event.clientX : width / 2;
    const originY = event.detail ? event.clientY : box.top + box.height / 2;
    const pieces = Array.from({ length: 50 }, (_, i) => ({
      x: originX,
      y: originY,
      vx: Math.cos(i * 2.399) * (3 + Math.random() * 8),
      vy: -4 - Math.random() * 11,
      rotation: Math.random() * 6,
      color: ["#FF4B2B", "#FFC53D", "#F5F0E6", "#244D3B"][i % 4],
    }));
    let count = 0;
    const draw = () => {
      context.clearRect(0, 0, width, height);
      pieces.forEach((piece) => {
        piece.x += piece.vx;
        piece.y += piece.vy;
        piece.vy += 0.22;
        piece.rotation += 0.06;
        context.save();
        context.translate(piece.x, piece.y);
        context.rotate(piece.rotation);
        context.globalAlpha = Math.min(1, (110 - count) / 25);
        context.fillStyle = piece.color;
        context.strokeStyle = "#14120F";
        context.fillRect(-7, -4, 14, 8);
        context.strokeRect(-7, -4, 14, 8);
        context.restore();
      });
      count++;
      if (count < 110) frame.current = requestAnimationFrame(draw);
      else context.clearRect(0, 0, width, height);
    };
    draw();
  }
  return (
    <footer className="m-footer">
      <svg
        className="m-footer-tear"
        viewBox="0 0 1440 24"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <path d="M0 0H1440V8L1420 20L1400 8L1380 20L1360 8L1340 20L1320 8L1300 20L1280 8L1260 20L1240 8L1220 20L1200 8L1180 20L1160 8L1140 20L1120 8L1100 20L1080 8L1060 20L1040 8L1020 20L1000 8L980 20L960 8L940 20L920 8L900 20L880 8L860 20L840 8L820 20L800 8L780 20L760 8L740 20L720 8L700 20L680 8L660 20L640 8L620 20L600 8L580 20L560 8L540 20L520 8L500 20L480 8L460 20L440 8L420 20L400 8L380 20L360 8L340 20L320 8L300 20L280 8L260 20L240 8L220 20L200 8L180 20L160 8L140 20L120 8L100 20L80 8L60 20L40 8L20 20L0 8Z" />
      </svg>
      <div className="m-container">
        <div className="m-footer-top">
          <div>
            <p className="m-eyebrow">Every great event starts somewhere.</p>
            <h2>First event free to host.</h2>
            <Link href={marketing.primaryCta.href} className="m-text-link">
              Let’s make something happen <span>↗</span>
            </Link>
          </div>
          <div className="m-footer-clock">
            <span className="m-clock-dot" />
            <span>
              DOORS OPEN: ALWAYS
              <br />
              <b>{clock} IST</b>
            </span>
          </div>
        </div>
        <div className="m-footer-links">
          {marketing.footer.map((group) => (
            <div key={group.label}>
              <h3 className="m-mono">{group.label}</h3>
              {group.links.map((link) => (
                <Link key={link.label} href={link.href}>
                  {link.label}
                </Link>
              ))}
            </div>
          ))}
        </div>
        <div className="m-footer-utility">
          <p>Made in India, for events everywhere.</p>
          <div>
            <ThemeToggle />
            <button
              className="m-back-top m-mono"
              onClick={() =>
                window.scrollTo({
                  top: 0,
                  behavior: reduced ? "instant" : "smooth",
                })
              }
            >
              Tear here ↑ back to top
            </button>
          </div>
        </div>
        <button
          className="m-footer-wordmark"
          onClick={celebrate}
          aria-label={`Celebrate with ${APP_NAME}`}
        >
          {APP_NAME.split("").map((letter, index) => (
            <motion.span
              key={index}
              aria-hidden="true"
              whileHover={
                reduced ? undefined : { y: -20, rotate: index % 2 ? 5 : -5 }
              }
              transition={{ type: "spring", stiffness: 280, damping: 14 }}
            >
              {letter}
            </motion.span>
          ))}
        </button>
        <div className="m-footer-bottom">
          © {new Date().getFullYear()} {APP_NAME}
        </div>
      </div>
      <canvas ref={canvas} className="m-confetti" aria-hidden="true" />
    </footer>
  );
}
