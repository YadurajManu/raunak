"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

export function VenueActions({
  query,
  address,
}: {
  query: string;
  address: string;
}) {
  const [copied, setCopied] = useState(false);
  const encoded = encodeURIComponent(query);
  return (
    <div className="event-venue-actions">
      {address && (
        <button
          type="button"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(address);
              setCopied(true);
              window.setTimeout(() => setCopied(false), 1800);
            } catch {
              setCopied(false);
            }
          }}
        >
          <>
            {copied ? (
              <Check size={15} aria-hidden="true" />
            ) : (
              <Copy size={15} aria-hidden="true" />
            )}
            {copied ? "Address copied" : "Copy address"}
          </>
        </button>
      )}
      <a
        href={`https://www.google.com/maps/dir/?api=1&destination=${encoded}`}
        target="_blank"
        rel="noopener noreferrer"
      >
        Directions in Google Maps
      </a>
      <a
        href={`https://maps.apple.com/?daddr=${encoded}`}
        target="_blank"
        rel="noopener noreferrer"
      >
        Directions in Apple Maps
      </a>
    </div>
  );
}
