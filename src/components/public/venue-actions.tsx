"use client";

import { Check, ChevronDown, Copy, Navigation } from "lucide-react";
import { useRef, useState } from "react";
import "./venue-transit.css";

export function VenueActions({ query, address }: { query: string; address: string }) {
  const [copied, setCopied] = useState(false);
  const menu = useRef<HTMLDetailsElement>(null);
  const encoded = encodeURIComponent(query || address);
  const google = `https://www.google.com/maps/dir/?api=1&destination=${encoded}`;
  const apple = `https://maps.apple.com/?daddr=${encoded}`;
  const appleFirst = typeof navigator !== "undefined" && /iPhone|iPad|iPod|Macintosh/i.test(navigator.userAgent);
  async function copyAddress() {
    try {
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(address);
      else {
        const field = document.createElement("textarea");
        field.value = address;
        field.style.position = "fixed";
        field.style.opacity = "0";
        document.body.append(field);
        field.select();
        document.execCommand("copy");
        field.remove();
      }
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
      menu.current?.removeAttribute("open");
    } catch { setCopied(false); }
  }
  return (
    <div className="venue-directions-actions">
      <details className="venue-directions-menu" ref={menu}>
        <summary aria-label="Open venue directions options">
          <Navigation size={16} aria-hidden="true" />
          <span>Directions</span>
          <ChevronDown size={15} aria-hidden="true" className="venue-directions-chevron" />
        </summary>
        <div role="group" aria-label="Choose a maps app">
          {(appleFirst ? [["Apple Maps", apple], ["Google Maps", google]] : [["Google Maps", google], ["Apple Maps", apple]]).map(([label, href]) => (
            <a key={label} href={href} target="_blank" rel="noopener noreferrer">{label}</a>
          ))}
          <button type="button" onClick={copyAddress}>
            {copied ? <Check size={16} aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />}
            {copied ? "Copied" : "Copy address"}
          </button>
        </div>
      </details>
      <span className="venue-directions-live" aria-live="polite">{copied ? "Address copied" : ""}</span>
    </div>
  );
}
