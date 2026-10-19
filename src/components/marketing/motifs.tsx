import type { ReactNode } from "react";

export function TicketShell({
  children,
  className = "",
  stub,
}: {
  children: ReactNode;
  className?: string;
  stub?: ReactNode;
}) {
  return (
    <div className={`m-ticket ${className}`}>
      <div className="m-ticket-body">{children}</div>
      {stub && (
        <>
          <Perforation />
          <div className="m-ticket-stub">{stub}</div>
        </>
      )}
    </div>
  );
}
export function Perforation({ className = "" }: { className?: string }) {
  return <div aria-hidden="true" className={`m-perforation ${className}`} />;
}
export function Stamp({
  text = "FIRST EVENT FREE",
  className = "",
}: {
  text?: string;
  className?: string;
}) {
  const id = `stamp-${text.toLowerCase().replace(/[^a-z]+/g, "-")}`;
  return (
    <svg
      className={`m-stamp ${className}`}
      viewBox="0 0 120 120"
      aria-hidden="true"
    >
      <defs>
        <path
          id={id}
          d="M 60,60 m -44,0 a 44,44 0 1,1 88,0 a 44,44 0 1,1 -88,0"
        />
      </defs>
      <circle
        cx="60"
        cy="60"
        r="56"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      />
      <circle
        cx="60"
        cy="60"
        r="34"
        fill="none"
        stroke="currentColor"
        strokeWidth="1"
        strokeDasharray="3 5"
      />
      <text>
        <textPath
          href={`#${id}`}
          startOffset="0%"
        >{`${text} • ${text} • `}</textPath>
      </text>
      <path
        d="M45 62l10 10 22-24"
        fill="none"
        stroke="currentColor"
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
export function Sticker({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <span className={`m-sticker ${className}`}>{children}</span>;
}
export function FakeQR({ size = 88 }: { size?: number }) {
  const cells = Array.from({ length: 21 * 21 }, (_, index) => {
    const x = index % 21;
    const y = Math.floor(index / 21);
    const finder = (ox: number, oy: number) =>
      x >= ox &&
      x < ox + 7 &&
      y >= oy &&
      y < oy + 7 &&
      (x === ox ||
        x === ox + 6 ||
        y === oy ||
        y === oy + 6 ||
        (x >= ox + 2 && x <= ox + 4 && y >= oy + 2 && y <= oy + 4));
    return (
      finder(0, 0) ||
      finder(14, 0) ||
      finder(0, 14) ||
      ((x * 17 + y * 31 + x * y * 7) % 11 < 5 &&
        !(x < 8 && y < 8) &&
        !(x > 12 && y < 8) &&
        !(x < 8 && y > 12))
    );
  });
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 21 21"
      aria-hidden="true"
      className="m-qr"
    >
      <rect width="21" height="21" fill="var(--qr-paper)" />
      {cells.map((filled, index) =>
        filled ? (
          <rect
            key={index}
            x={index % 21}
            y={Math.floor(index / 21)}
            width="1"
            height="1"
            fill="var(--qr-ink)"
          />
        ) : null,
      )}
    </svg>
  );
}
export function Marquee({ items }: { items: readonly string[] }) {
  return (
    <div className="m-marquee" role="img" aria-label={items.join(", ")}>
      <div className="m-marquee-track" aria-hidden="true">
        {[0, 1].map((copy) => (
          <div className="m-marquee-set" key={copy}>
            {items.map((item) => (
              <span key={item}>
                <i>✳</i>
                {item}
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
