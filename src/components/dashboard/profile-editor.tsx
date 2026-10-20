"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Check,
  ExternalLink,
  Globe,
  Eye,
  EyeOff,
  Save,
} from "lucide-react";
import Link from "next/link";
import "./profile-editor.css";

type SocialLinks = {
  instagram?: string;
  twitter?: string;
  youtube?: string;
  website?: string;
  linkedin?: string;
};

type ProfileEditorProps = {
  orgId: string;
  orgSlug: string;
  orgName: string;
  initial: {
    tagline: string;
    bio: string;
    socialLinks: SocialLinks;
    supportEmail: string;
    supportPhone: string;
    profileVisible: boolean;
  };
};

export function ProfileEditor({
  orgId,
  orgSlug,
  orgName,
  initial,
}: ProfileEditorProps) {
  const router = useRouter();
  const [tagline, setTagline] = useState(initial.tagline);
  const [bio, setBio] = useState(initial.bio);
  const [supportEmail, setSupportEmail] = useState(initial.supportEmail);
  const [supportPhone, setSupportPhone] = useState(initial.supportPhone);
  const [profileVisible, setProfileVisible] = useState(
    initial.profileVisible,
  );
  const [socials, setSocials] = useState<SocialLinks>(initial.socialLinks);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  function updateSocial(key: keyof SocialLinks, value: string) {
    setSocials((prev) => ({ ...prev, [key]: value }));
    clearMessages();
  }

  function clearMessages() {
    setError("");
    setSuccess("");
  }

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    clearMessages();
    try {
      const response = await fetch(`/api/orgs/${orgId}/profile`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tagline: tagline.trim(),
          bio: bio.trim(),
          socialLinks: socials,
          supportEmail: supportEmail.trim(),
          supportPhone: supportPhone.trim(),
          profileVisible,
        }),
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.error || "Could not save profile.");
      setSuccess("Profile saved. Changes are live on your public page.");
      router.refresh();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not save profile.",
      );
    } finally {
      setSaving(false);
    }
  }

  const profileUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/organizers/${orgSlug}`;

  return (
    <main className="pe-page">
      <Link href={`/dashboard/events?org=${orgId}`} className="pe-back">
        <ArrowLeft size={16} aria-hidden="true" />
        <span>← Workspace events</span>
      </Link>

      <div className="pe-grid">
        {/* Left column — Context */}
        <aside className="pe-aside">
          <p className="pe-eyebrow">PUBLIC PROFILE</p>
          <h1>
            Your brand, <em className="m-serif">your stage.</em>
          </h1>
          <p className="pe-intro">
            Customize how attendees see your organizer page. Add your story,
            social links, and contact info to build trust before they buy a
            ticket.
          </p>

          <div className="pe-preview-card">
            <p className="pe-preview-label">
              <Globe size={14} aria-hidden="true" /> LIVE PROFILE URL
            </p>
            <a
              href={profileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="pe-preview-url"
            >
              raunak.yaduraj.me/organizers/
              <strong>{orgSlug}</strong>
              <ExternalLink size={12} aria-hidden="true" />
            </a>
          </div>

          <div className="pe-perks">
            <span className="pe-perk">
              <Check size={14} aria-hidden="true" /> Builds attendee trust
            </span>
            <span className="pe-perk">
              <Check size={14} aria-hidden="true" /> SEO-indexed by Google
            </span>
            <span className="pe-perk">
              <Check size={14} aria-hidden="true" /> Auto-shows your events
            </span>
          </div>
        </aside>

        {/* Right column — Form */}
        <section className="pe-card" aria-labelledby="pe-heading">
          <div className="pe-card-header">
            <h2 id="pe-heading">{orgName}</h2>
            <p>
              Edit your public profile details. Changes appear immediately on
              your organizer page.
            </p>
          </div>

          <form onSubmit={save} className="pe-form">
            {/* Tagline */}
            <div className="pe-field">
              <label htmlFor="pe-tagline">
                <span>Tagline</span>
                <span className="pe-help">
                  {tagline.length}/160 — One-liner your community sees first
                </span>
              </label>
              <input
                id="pe-tagline"
                value={tagline}
                onChange={(e) => {
                  setTagline(e.target.value);
                  clearMessages();
                }}
                maxLength={160}
                placeholder="e.g. Delhi's favourite open-mic community"
                readOnly={saving}
              />
            </div>

            {/* Bio */}
            <div className="pe-field">
              <label htmlFor="pe-bio">
                <span>About / Bio</span>
                <span className="pe-help">
                  {bio.length}/2000 — Tell your story
                </span>
              </label>
              <textarea
                id="pe-bio"
                value={bio}
                onChange={(e) => {
                  setBio(e.target.value);
                  clearMessages();
                }}
                maxLength={2000}
                placeholder="Who are you? What kind of events do you host? What makes your community special?"
                readOnly={saving}
                rows={6}
              />
            </div>

            {/* Support contact */}
            <fieldset className="pe-fieldset">
              <legend>Contact information</legend>
              <div className="pe-field-row">
                <div className="pe-field">
                  <label htmlFor="pe-email">
                    <span>Support email</span>
                  </label>
                  <input
                    id="pe-email"
                    type="email"
                    value={supportEmail}
                    onChange={(e) => {
                      setSupportEmail(e.target.value);
                      clearMessages();
                    }}
                    placeholder="hello@yourorg.com"
                    readOnly={saving}
                  />
                </div>
                <div className="pe-field">
                  <label htmlFor="pe-phone">
                    <span>Support phone</span>
                  </label>
                  <input
                    id="pe-phone"
                    type="tel"
                    value={supportPhone}
                    onChange={(e) => {
                      setSupportPhone(e.target.value);
                      clearMessages();
                    }}
                    placeholder="+91 98765 43210"
                    maxLength={20}
                    readOnly={saving}
                  />
                </div>
              </div>
            </fieldset>

            {/* Social Links */}
            <fieldset className="pe-fieldset">
              <legend>Social links</legend>
              <div className="pe-field">
                <label htmlFor="pe-website">
                  <span>Website</span>
                </label>
                <input
                  id="pe-website"
                  type="url"
                  value={socials.website || ""}
                  onChange={(e) => updateSocial("website", e.target.value)}
                  placeholder="https://yourorg.com"
                  readOnly={saving}
                />
              </div>
              <div className="pe-field">
                <label htmlFor="pe-instagram">
                  <span>Instagram</span>
                </label>
                <input
                  id="pe-instagram"
                  type="url"
                  value={socials.instagram || ""}
                  onChange={(e) => updateSocial("instagram", e.target.value)}
                  placeholder="https://instagram.com/yourorg"
                  readOnly={saving}
                />
              </div>
              <div className="pe-field-row">
                <div className="pe-field">
                  <label htmlFor="pe-twitter">
                    <span>X / Twitter</span>
                  </label>
                  <input
                    id="pe-twitter"
                    type="url"
                    value={socials.twitter || ""}
                    onChange={(e) => updateSocial("twitter", e.target.value)}
                    placeholder="https://x.com/yourorg"
                    readOnly={saving}
                  />
                </div>
                <div className="pe-field">
                  <label htmlFor="pe-youtube">
                    <span>YouTube</span>
                  </label>
                  <input
                    id="pe-youtube"
                    type="url"
                    value={socials.youtube || ""}
                    onChange={(e) => updateSocial("youtube", e.target.value)}
                    placeholder="https://youtube.com/@yourorg"
                    readOnly={saving}
                  />
                </div>
              </div>
              <div className="pe-field">
                <label htmlFor="pe-linkedin">
                  <span>LinkedIn</span>
                </label>
                <input
                  id="pe-linkedin"
                  type="url"
                  value={socials.linkedin || ""}
                  onChange={(e) => updateSocial("linkedin", e.target.value)}
                  placeholder="https://linkedin.com/company/yourorg"
                  readOnly={saving}
                />
              </div>
            </fieldset>

            {/* Profile Visibility */}
            <div className="pe-visibility">
              <button
                type="button"
                className={`pe-visibility-toggle ${profileVisible ? "is-visible" : "is-hidden"}`}
                onClick={() => {
                  setProfileVisible(!profileVisible);
                  clearMessages();
                }}
                aria-pressed={profileVisible}
              >
                {profileVisible ? (
                  <Eye size={16} aria-hidden="true" />
                ) : (
                  <EyeOff size={16} aria-hidden="true" />
                )}
                <span>
                  Public profile is{" "}
                  <strong>{profileVisible ? "visible" : "hidden"}</strong>
                </span>
              </button>
              <p className="pe-help">
                {profileVisible
                  ? "Anyone can find your profile at the URL above."
                  : "Your profile page is hidden from the public. Only you can preview it."}
              </p>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={saving}
              className="pe-submit"
            >
              <Save size={16} aria-hidden="true" />
              <span>{saving ? "Saving…" : "Save profile"}</span>
            </button>

            {error && (
              <p role="alert" className="pe-error">
                {error}
              </p>
            )}
            {success && (
              <p role="status" className="pe-success">
                <Check size={14} aria-hidden="true" /> {success}
              </p>
            )}

            <div className="pe-card-footer">
              <span>
                Changes are instant · Profile auto-shows your events ·{" "}
                <a
                  href={profileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: "var(--accent)" }}
                >
                  Preview profile ↗
                </a>
              </span>
            </div>
          </form>
        </section>
      </div>
    </main>
  );
}
