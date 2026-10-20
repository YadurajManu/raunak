"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, Sparkles, Globe } from "lucide-react";
import "./setup.css";

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function OnboardingForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [isSlugManuallyEdited, setIsSlugManuallyEdited] = useState(false);
  const [error, setError] = useState("");
  const [errorField, setErrorField] = useState("");
  const [busy, setBusy] = useState(false);

  function handleNameChange(event: React.ChangeEvent<HTMLInputElement>) {
    const val = event.target.value;
    setName(val);
    if (errorField === "name") {
      setError("");
      setErrorField("");
    }
    if (!isSlugManuallyEdited) {
      setSlug(slugify(val));
    }
  }

  function handleSlugChange(event: React.ChangeEvent<HTMLInputElement>) {
    setIsSlugManuallyEdited(true);
    setSlug(slugify(event.target.value));
    if (errorField === "slug") {
      setError("");
      setErrorField("");
    }
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setErrorField("");
    const form = event.currentTarget;
    try {
      const response = await fetch("/api/orgs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          slug: slug.trim(),
        }),
      });
      const result = await response.json();
      if (response.ok) {
        router.push("/dashboard");
        router.refresh();
      } else {
        setError(result.error || "Could not create workspace.");
        setErrorField(result.field || "");
        if (result.field === "slug" || result.field === "name") {
          form.querySelector<HTMLInputElement>(`#${result.field}`)?.focus();
        }
        setBusy(false);
      }
    } catch {
      setError("Could not create workspace. Please try again.");
      setBusy(false);
    }
  }

  return (
    <main className="r-setup-page">
      <Link href="/account" className="r-setup-back">
        <ArrowLeft size={16} aria-hidden="true" />
        <span>Back to attendee view</span>
      </Link>

      <div className="r-setup-grid">
        <aside className="r-setup-aside">
          <div className="r-setup-eyebrow">
            <Sparkles size={14} aria-hidden="true" />
            <span>HOST ON RAUNAK · ZERO SETUP FEES</span>
          </div>

          <h1>
            Turn your gatherings into <em>lasting community.</em>
          </h1>

          <p className="r-setup-intro">
            One workspace for your team, event drafts, ticket sales, and verified
            attendee rosters. Your brand identity starts here.
          </p>

          <ol className="r-setup-timeline" aria-label="Organizer launchpad steps">
            <li className="r-setup-step is-active">
              <span className="r-setup-step-num" aria-hidden="true">
                1
              </span>
              <div className="r-setup-step-text">
                <strong>Create your workspace</strong>
                <span>Set your name and public organizer profile URL</span>
              </div>
            </li>
            <li className="r-setup-step">
              <span className="r-setup-step-num" aria-hidden="true">
                2
              </span>
              <div className="r-setup-step-text">
                <strong>Design your event draft</strong>
                <span>Add posters, dates, venues, and ticket tiers</span>
              </div>
            </li>
            <li className="r-setup-step">
              <span className="r-setup-step-num" aria-hidden="true">
                3
              </span>
              <div className="r-setup-step-text">
                <strong>Publish & receive direct UPI payouts</strong>
                <span>Automated WhatsApp tickets and QR door scanning</span>
              </div>
            </li>
          </ol>

          <div className="r-setup-perks">
            <span className="r-setup-perk-badge">
              <Check size={14} aria-hidden="true" /> First event free to host
            </span>
            <span className="r-setup-perk-badge">
              <Check size={14} aria-hidden="true" /> Instant attendee check-in
            </span>
            <span className="r-setup-perk-badge">
              <Check size={14} aria-hidden="true" /> WhatsApp ticket delivery
            </span>
          </div>
        </aside>

        <section className="r-setup-card" aria-labelledby="r-setup-heading">
          <div className="r-setup-card-header">
            <h2 id="r-setup-heading">Create your workspace</h2>
            <p>Your team, draft events, and public listing live in this workspace.</p>
          </div>

          <form onSubmit={submit} className="r-setup-form">
            <div className="r-setup-field">
              <label htmlFor="name">
                <span>Workspace name</span>
                <span className="r-setup-help">What attendees see</span>
              </label>
              <input
                id="name"
                name="name"
                value={name}
                onChange={handleNameChange}
                required
                minLength={2}
                maxLength={100}
                placeholder="e.g. Delhi Sunset Club"
                readOnly={busy}
                aria-invalid={errorField === "name" || undefined}
                aria-describedby={errorField === "name" ? "name-error" : undefined}
                autoFocus
              />
              {error && errorField === "name" && (
                <p id="name-error" role="alert" className="r-setup-error">
                  {error}
                </p>
              )}
            </div>

            <div className="r-setup-field">
              <label htmlFor="slug">
                <span>Workspace URL name</span>
                <span className="r-setup-help">Public link identifier</span>
              </label>
              <input
                id="slug"
                name="slug"
                value={slug}
                onChange={handleSlugChange}
                required
                pattern="[a-z0-9]+(-[a-z0-9]+)*"
                minLength={3}
                maxLength={80}
                placeholder="delhi-sunset-club"
                readOnly={busy}
                autoCapitalize="none"
                spellCheck={false}
                aria-invalid={errorField === "slug" || undefined}
                aria-describedby="workspace-slug-preview workspace-slug-help"
              />

              <div id="workspace-slug-preview" className="r-setup-url-preview">
                <Globe size={14} aria-hidden="true" />
                <span>
                  raunak.yaduraj.me/organizers/
                  <strong>{slug || "your-workspace"}</strong>
                </span>
              </div>

              <p id="workspace-slug-help" className="r-setup-help">
                Use lowercase letters, numbers, and hyphens. You can customize this anytime.
              </p>

              {error && errorField === "slug" && (
                <p id="workspace-error" role="alert" className="r-setup-error">
                  {error}
                </p>
              )}
            </div>

            <button type="submit" disabled={busy || !name.trim()} className="r-setup-submit">
              <span>{busy ? "Creating workspace…" : "Create workspace & continue"}</span>
              <ArrowRight size={16} aria-hidden="true" />
            </button>

            {error && errorField !== "name" && errorField !== "slug" && (
              <p role="alert" className="r-setup-error">
                {error}
              </p>
            )}

            <div className="r-setup-card-footer">
              <span>No credit card required · Free to publish · Invite co-hosts anytime</span>
            </div>
          </form>
        </section>
      </div>
    </main>
  );
}
