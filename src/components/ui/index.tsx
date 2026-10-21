"use client";

import Link from "next/link";
import { useId, useRef, type ReactNode } from "react";
import { ArrowLeft, LoaderCircle, Upload } from "lucide-react";

export function PageHeader({ backHref, backLabel = "Back", title, description, actions }: { backHref?: string; backLabel?: string; title: string; description?: string; actions?: ReactNode }) {
  return <header className="ui-page-header">{backHref && <Link className="ui-back" href={backHref}><ArrowLeft size={16} aria-hidden="true" />{backLabel.replace(/^[←\s]+/, "")}</Link>}<div className="ui-page-heading"><div><h1>{title}</h1>{description && <p>{description}</p>}</div>{actions && <div className="ui-header-actions">{actions}</div>}</div></header>;
}
export function SectionHeader({ title, count, actions, id }: { title: string; count?: number; actions?: ReactNode; id?: string }) {
  return <div className="ui-section-header"><h2 id={id}>{title}{count !== undefined && <span className="ui-count">{count}</span>}</h2>{actions && <div className="ui-header-actions">{actions}</div>}</div>;
}
export function Section({ title, description, id, children }: { title: string; description?: string; id?: string; children: ReactNode }) {
  return <section className="ui-section" id={id}><SectionHeader title={title} />{description && <p className="ui-section-description">{description}</p>}{children}</section>;
}
export function Card({ children, className = "" }: { children: ReactNode; className?: string }) { return <div className={`ui-card ${className}`}>{children}</div>; }
export function FormField({ label, htmlFor, hint, error, counter, children }: { label: string; htmlFor: string; hint?: ReactNode; error?: string; counter?: ReactNode; children: ReactNode }) {
  return <div className="ui-field"><label htmlFor={htmlFor}>{label}</label>{children}<div className="ui-field-help">{hint && <span id={`${htmlFor}-hint`}>{hint}</span>}{counter && <span className="ui-counter">{counter}</span>}</div>{error && <p className="ui-error" role="alert" id={`${htmlFor}-error`}>{error}</p>}</div>;
}
export function StickySaveBar({ dirty, busy, onDiscard, formId, status }: { dirty: boolean; busy: boolean; onDiscard: () => void; formId: string; status?: string }) {
  return <><p className="ui-save-status" role="status">{status}</p>{dirty && <div className="ui-save-bar"><span>You have unsaved changes</span><div><button type="button" className="ui-button" disabled={busy} onClick={onDiscard}>Discard</button><button className="ui-button ui-primary" type="submit" form={formId} disabled={busy}>{busy && <LoaderCircle size={16} className="ui-spinner" aria-hidden="true" />}{busy ? "Saving…" : "Save changes"}</button></div></div>}</>;
}
export function InitialsAvatar({ name, src, size = 40 }: { name: string; src?: string | null; size?: number }) {
  return <span className="ui-avatar" style={{ width: size, height: size, fontSize: Math.max(14, size / 3) }}>{src ? <img src={src} alt="" /> : <span aria-hidden="true">{name.trim().split(/\s+/).slice(0, 2).map(word => word[0]).join("").toUpperCase() || "R"}</span>}</span>;
}
export function StatusChip({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "success" | "warning" }) { return <span className="ui-status-chip" data-tone={tone}>{children}</span>; }
export function SegmentedControl({ label, value, options, onChange }: { label: string; value: string; options: { value: string; label: string }[]; onChange: (value: string) => void }) {
  const name = useId();
  return <fieldset className="ui-segmented"><legend className="sr-only">{label}</legend>{options.map(option => <label key={option.value}><input type="radio" name={name} value={option.value} checked={value === option.value} onChange={() => onChange(option.value)} /><span>{option.label}</span></label>)}</fieldset>;
}
export function ImageField({ label, hint, children, onFiles, accept = "image/*", busy = false, error }: { label: string; hint?: string; children?: ReactNode; onFiles: (files: FileList) => void; accept?: string; busy?: boolean; error?: string }) {
  const input = useRef<HTMLInputElement>(null);
  return <div className="ui-image-field" onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); if (!busy && event.dataTransfer.files.length) onFiles(event.dataTransfer.files); }}>{children}<input ref={input} hidden type="file" accept={accept} disabled={busy} aria-label={label} onChange={event => { if (event.target.files?.length) onFiles(event.target.files); event.target.value = ""; }} /><button className="ui-button" type="button" disabled={busy} onClick={() => input.current?.click()}><Upload size={16} aria-hidden="true" />{busy ? "Uploading…" : label}</button>{hint && <p>{hint}</p>}{error && <p className="ui-error" role="alert">{error}</p>}</div>;
}
export function SettingsNavigation({ orgId, current, className = "" }: { orgId: string; current: "profile" | "team" | "whatsapp" | "messages"; className?: string }) {
  return <nav className={`ui-settings-nav ${className}`} aria-label="Workspace settings">{([ ["profile", "/dashboard/settings/profile", "Profile"], ["team", "/dashboard/team", "Team"], ["whatsapp", "/dashboard/settings/whatsapp", "WhatsApp"], ["messages", "/dashboard/settings/messages", "Message defaults"] ] as const).map(([key, href, label]) => <Link key={key} href={`${href}?org=${orgId}`} aria-current={current === key ? "page" : undefined}>{label}</Link>)}</nav>;
}
