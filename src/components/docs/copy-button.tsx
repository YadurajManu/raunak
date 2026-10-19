"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

export function CopyButton({ text, label = "Copy code" }: { text: string; label?: string }) {
  const [feedback, setFeedback] = useState("");
  return <button className="docs-copy" aria-label={feedback || label} title={feedback || label} onClick={async () => {
    try { await navigator.clipboard.writeText(text); setFeedback("Copied"); }
    catch { setFeedback("Copy failed. Select the text to copy it."); }
  }}>{feedback === "Copied" ? <Check size={15} aria-hidden="true" /> : <Copy size={15} aria-hidden="true" />}<span>{feedback === "Copied" ? "Copied" : "Copy"}</span><span className="docs-sr-only" role="status">{feedback}</span></button>;
}

export function HeadingLink({ id, title }: { id: string; title: string }) {
  const [copied, setCopied] = useState(false);
  return <a className="docs-heading-link" aria-label={`Link to ${title}${copied ? ", copied" : ""}`} href={`#${id}`} onClick={() => {
    const url = new URL(window.location.href); url.hash = id;
    navigator.clipboard?.writeText(url.href).then(() => setCopied(true)).catch(() => {});
  }}>#<span className="docs-sr-only" role="status">{copied ? "Section link copied" : ""}</span></a>;
}
