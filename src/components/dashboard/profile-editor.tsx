"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Check,
  ExternalLink,
  Globe,
  Eye,
  EyeOff,
  Save,
  Upload,
  Trash2,
  RotateCw,
  Smartphone,
  Monitor,
  Image as ImageIcon,
  Sparkles,
  Plus,
  X,
  AlertCircle,
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

type HighlightItem = {
  id: string;
  url: string;
  caption?: string;
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
    logoKey?: string;
    coverKey?: string;
    coverPosition?: string;
    highlights?: HighlightItem[];
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
  const [profileVisible, setProfileVisible] = useState(initial.profileVisible);
  const [socials, setSocials] = useState<SocialLinks>(initial.socialLinks);

  // Branding states
  const [logoKey, setLogoKey] = useState(initial.logoKey || "");
  const [coverKey, setCoverKey] = useState(initial.coverKey || "");
  const [coverPosition, setCoverPosition] = useState(initial.coverPosition || "center");
  const [highlights, setHighlights] = useState<HighlightItem[]>(initial.highlights || []);

  // Upload states
  const [logoProgress, setLogoProgress] = useState<number | null>(null);
  const [logoProcessing, setLogoProcessing] = useState(false);
  const [logoError, setLogoError] = useState("");
  const [coverProgress, setCoverProgress] = useState<number | null>(null);
  const [coverProcessing, setCoverProcessing] = useState(false);
  const [coverError, setCoverError] = useState("");

  // Preview device toggle
  const [previewDevice, setPreviewDevice] = useState<"desktop" | "mobile">("desktop");
  const [showLiveDrawer, setShowLiveDrawer] = useState(false);

  // Highlights state
  const [newHighlightUrl, setNewHighlightUrl] = useState("");
  const [newHighlightCaption, setNewHighlightCaption] = useState("");
  const [addingHighlight, setAddingHighlight] = useState(false);

  // Form saving states
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const logoInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  function updateSocial(key: keyof SocialLinks, value: string) {
    setSocials((prev) => ({ ...prev, [key]: value }));
    clearMessages();
  }

  function clearMessages() {
    setError("");
    setSuccess("");
  }

  // Handle Logo Upload with real progress
  async function handleLogoUpload(file: File) {
    setLogoError("");
    setLogoProgress(0);
    setLogoProcessing(false);

    const formData = new FormData();
    formData.append("file", file);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", `/api/orgs/${orgId}/logo`);

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        const percent = Math.round((event.loaded / event.total) * 100);
        setLogoProgress(percent);
        if (percent === 100) {
          setLogoProcessing(true);
        }
      }
    };

    xhr.onload = () => {
      setLogoProcessing(false);
      setLogoProgress(null);
      try {
        const result = JSON.parse(xhr.responseText);
        if (xhr.status >= 200 && xhr.status < 300 && result.ok) {
          setLogoKey(result.logoKey);
          setSuccess("Logo uploaded and updated.");
          router.refresh();
        } else {
          setLogoError(result.error || "Upload failed. Please try again.");
        }
      } catch {
        setLogoError("Upload failed. Please check the file and try again.");
      }
    };

    xhr.onerror = () => {
      setLogoProcessing(false);
      setLogoProgress(null);
      setLogoError("Network error while uploading logo.");
    };

    xhr.send(formData);
  }

  async function handleRemoveLogo() {
    if (!confirm("Are you sure you want to remove your organizer logo?")) return;
    try {
      const res = await fetch(`/api/orgs/${orgId}/logo`, { method: "DELETE" });
      if (!res.ok) throw new Error("Could not remove logo.");
      setLogoKey("");
      setSuccess("Logo removed.");
      router.refresh();
    } catch (e) {
      setLogoError(e instanceof Error ? e.message : "Could not remove logo.");
    }
  }

  // Handle Cover Upload with real progress
  async function handleCoverUpload(file: File) {
    setCoverError("");
    setCoverProgress(0);
    setCoverProcessing(false);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("position", coverPosition);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", `/api/orgs/${orgId}/cover`);

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        const percent = Math.round((event.loaded / event.total) * 100);
        setCoverProgress(percent);
        if (percent === 100) {
          setCoverProcessing(true);
        }
      }
    };

    xhr.onload = () => {
      setCoverProcessing(false);
      setCoverProgress(null);
      try {
        const result = JSON.parse(xhr.responseText);
        if (xhr.status >= 200 && xhr.status < 300 && result.ok) {
          setCoverKey(result.coverKey);
          setSuccess("Cover banner uploaded and updated.");
          router.refresh();
        } else {
          setCoverError(result.error || "Upload failed. Please try again.");
        }
      } catch {
        setCoverError("Upload failed. Please check the file and try again.");
      }
    };

    xhr.onerror = () => {
      setCoverProcessing(false);
      setCoverProgress(null);
      setCoverError("Network error while uploading cover banner.");
    };

    xhr.send(formData);
  }

  async function handleRemoveCover() {
    if (!confirm("Are you sure you want to remove your cover banner?")) return;
    try {
      const res = await fetch(`/api/orgs/${orgId}/cover`, { method: "DELETE" });
      if (!res.ok) throw new Error("Could not remove cover.");
      setCoverKey("");
      setSuccess("Cover banner removed.");
      router.refresh();
    } catch (e) {
      setCoverError(e instanceof Error ? e.message : "Could not remove cover.");
    }
  }

  function handleAddHighlight() {
    if (!newHighlightUrl.trim()) return;
    const newItem: HighlightItem = {
      id: `hl-${Date.now()}`,
      url: newHighlightUrl.trim(),
      caption: newHighlightCaption.trim() || undefined,
    };
    setHighlights((prev) => [...prev, newItem]);
    setNewHighlightUrl("");
    setNewHighlightCaption("");
    setAddingHighlight(false);
    clearMessages();
  }

  function handleRemoveHighlight(id: string) {
    setHighlights((prev) => prev.filter((item) => item.id !== id));
    clearMessages();
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
          coverPosition,
          highlights,
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

  // Checklist calculations
  const checklist = [
    { label: "Profile photo / logo", done: Boolean(logoKey) },
    { label: "Cover banner", done: Boolean(coverKey) },
    { label: "Catchy tagline", done: Boolean(tagline && tagline.trim().length >= 5) },
    { label: "Detailed bio", done: Boolean(bio && bio.trim().length >= 20) },
    { label: "Contact details", done: Boolean(supportEmail || supportPhone) },
    {
      label: "Social links",
      done: Boolean(
        socials.instagram ||
          socials.twitter ||
          socials.youtube ||
          socials.website ||
          socials.linkedin,
      ),
    },
  ];
  const completedCount = checklist.filter((item) => item.done).length;
  const completionPercentage = Math.round((completedCount / checklist.length) * 100);

  return (
    <main className="pe-page">
      <Link href={`/dashboard/events?org=${orgId}`} className="pe-back">
        <ArrowLeft size={16} aria-hidden="true" />
        <span>← Workspace events</span>
      </Link>

      <div className="pe-grid">
        {/* Left column — Context & Checklist */}
        <aside className="pe-aside">
          <p className="pe-eyebrow">
            <Sparkles size={14} aria-hidden="true" /> PUBLIC BRANDING
          </p>
          <h1>
            Your brand, <em className="m-serif">your stage.</em>
          </h1>
          <p className="pe-intro">
            Customize how attendees see your organizer page. Upload your logo and banner,
            share your story, and build credibility before tickets go on sale.
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
            <button
              type="button"
              className="pe-live-preview-btn"
              onClick={() => setShowLiveDrawer(true)}
            >
              <Eye size={14} aria-hidden="true" /> Quick preview
            </button>
          </div>

          {/* Profile Checklist */}
          <div className="pe-checklist-card">
            <div className="pe-checklist-header">
              <h3>Profile completeness</h3>
              <span className="pe-checklist-pct">{completionPercentage}%</span>
            </div>
            <div
              className="pe-checklist-bar"
              role="progressbar"
              aria-valuenow={completionPercentage}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div
                className="pe-checklist-fill"
                style={{ width: `${completionPercentage}%` }}
              />
            </div>
            <ul className="pe-checklist-items">
              {checklist.map((item) => (
                <li
                  key={item.label}
                  className={item.done ? "is-done" : "is-pending"}
                >
                  <span className="pe-check-icon">
                    {item.done ? "✓" : "○"}
                  </span>
                  <span>{item.label}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="pe-perks">
            <span className="pe-perk">
              <Check size={14} aria-hidden="true" /> Auto-updates on event cards
            </span>
            <span className="pe-perk">
              <Check size={14} aria-hidden="true" /> Shown on &quot;Hosted by&quot; sections
            </span>
            <span className="pe-perk">
              <Check size={14} aria-hidden="true" /> Follow button for fans
            </span>
          </div>
        </aside>

        {/* Right column — Form */}
        <div className="pe-main-col">
          {/* Images & Branding Section */}
          <section className="pe-card" aria-labelledby="pe-branding-heading">
            <div className="pe-card-header">
              <h2 id="pe-branding-heading">Images & branding</h2>
              <p>
                Visual identity for your organizer page, event cards, and ticket headers.
              </p>
            </div>

            <div className="pe-branding-body">
              {/* Profile photo or Logo */}
              <div className="pe-brand-item">
                <div className="pe-brand-item-header">
                  <div>
                    <h4>Profile photo or logo</h4>
                    <p className="pe-help">Square 1:1 image · 512×512px WebP recommended</p>
                  </div>
                  {logoKey && (
                    <button
                      type="button"
                      className="pe-btn-remove"
                      onClick={handleRemoveLogo}
                    >
                      <Trash2 size={13} aria-hidden="true" /> Remove
                    </button>
                  )}
                </div>

                <div className="pe-logo-row">
                  <div className="pe-logo-preview">
                    {logoKey ? (
                      <img src={logoKey} alt={`${orgName} logo`} />
                    ) : (
                      <span className="pe-logo-fallback">{orgName.charAt(0)}</span>
                    )}
                  </div>
                  <div className="pe-logo-actions">
                    <input
                      ref={logoInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/avif,image/heic"
                      style={{ display: "none" }}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleLogoUpload(file);
                        e.target.value = "";
                      }}
                    />
                    <button
                      type="button"
                      className="pe-btn-upload"
                      onClick={() => logoInputRef.current?.click()}
                      disabled={logoProgress !== null || logoProcessing}
                    >
                      <Upload size={14} aria-hidden="true" />
                      <span>{logoKey ? "Replace logo" : "Upload photo or logo"}</span>
                    </button>

                    {logoProgress !== null && (
                      <div className="pe-upload-progress">
                        <div className="pe-progress-track">
                          <div
                            className="pe-progress-bar"
                            style={{ width: `${logoProgress}%` }}
                          />
                        </div>
                        <span className="pe-progress-label">
                          {logoProcessing ? "Optimizing WebP…" : `${logoProgress}%`}
                        </span>
                      </div>
                    )}

                    {logoError && (
                      <div className="pe-inline-error">
                        <AlertCircle size={14} aria-hidden="true" />
                        <span>{logoError}</span>
                        <button
                          type="button"
                          onClick={() => logoInputRef.current?.click()}
                        >
                          Retry
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Cover Banner */}
              <div className="pe-brand-item">
                <div className="pe-brand-item-header">
                  <div>
                    <h4>Cover banner photo</h4>
                    <p className="pe-help">
                      Wide hero backdrop · Recommended 1920×640px · High resolution
                    </p>
                  </div>
                  {coverKey && (
                    <button
                      type="button"
                      className="pe-btn-remove"
                      onClick={handleRemoveCover}
                    >
                      <Trash2 size={13} aria-hidden="true" /> Remove
                    </button>
                  )}
                </div>

                {/* Banner Device Preview & Position Controls */}
                <div className="pe-cover-controls">
                  <div className="pe-device-tabs" role="tablist">
                    <button
                      type="button"
                      className={previewDevice === "desktop" ? "is-active" : ""}
                      onClick={() => setPreviewDevice("desktop")}
                    >
                      <Monitor size={14} aria-hidden="true" /> Desktop (16:6)
                    </button>
                    <button
                      type="button"
                      className={previewDevice === "mobile" ? "is-active" : ""}
                      onClick={() => setPreviewDevice("mobile")}
                    >
                      <Smartphone size={14} aria-hidden="true" /> Mobile (16:9)
                    </button>
                  </div>

                  <div className="pe-pos-selector">
                    <span>Position:</span>
                    {(["top", "center", "bottom"] as const).map((pos) => (
                      <button
                        key={pos}
                        type="button"
                        className={coverPosition === pos ? "is-active" : ""}
                        onClick={() => {
                          setCoverPosition(pos);
                          clearMessages();
                        }}
                      >
                        {pos.charAt(0).toUpperCase() + pos.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Cover Banner Canvas Preview */}
                <div
                  className={`pe-cover-preview pe-cover-${previewDevice}`}
                  style={{
                    background: coverKey
                      ? undefined
                      : "radial-gradient(ellipse at 15% 20%, var(--scrim-soft) 0%, transparent 70%), linear-gradient(135deg, var(--art-poster-dark) 0%, var(--surface-raised) 100%)",
                  }}
                >
                  {coverKey ? (
                    <img
                      src={coverKey}
                      alt={`${orgName} banner`}
                      style={{ objectPosition: coverPosition }}
                    />
                  ) : (
                    <div className="pe-cover-placeholder">
                      <ImageIcon size={28} aria-hidden="true" />
                      <span>No custom banner uploaded. Using warm editorial gradient.</span>
                    </div>
                  )}
                </div>

                <div className="pe-cover-actions">
                  <input
                    ref={coverInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/avif,image/heic"
                    style={{ display: "none" }}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleCoverUpload(file);
                      e.target.value = "";
                    }}
                  />
                  <button
                    type="button"
                    className="pe-btn-upload"
                    onClick={() => coverInputRef.current?.click()}
                    disabled={coverProgress !== null || coverProcessing}
                  >
                    <Upload size={14} aria-hidden="true" />
                    <span>{coverKey ? "Replace banner" : "Upload cover photo"}</span>
                  </button>

                  {coverProgress !== null && (
                    <div className="pe-upload-progress">
                      <div className="pe-progress-track">
                        <div
                          className="pe-progress-bar"
                          style={{ width: `${coverProgress}%` }}
                        />
                      </div>
                      <span className="pe-progress-label">
                        {coverProcessing ? "Optimizing WebP…" : `${coverProgress}%`}
                      </span>
                    </div>
                  )}

                  {coverError && (
                    <div className="pe-inline-error">
                      <AlertCircle size={14} aria-hidden="true" />
                      <span>{coverError}</span>
                      <button
                        type="button"
                        onClick={() => coverInputRef.current?.click()}
                      >
                        Retry
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </section>

          {/* Form details section */}
          <section className="pe-card" aria-labelledby="pe-heading">
            <div className="pe-card-header">
              <h2 id="pe-heading">{orgName} Profile Details</h2>
              <p>
                Edit your public narrative, contact information, and social links.
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
                  rows={5}
                />
              </div>

              {/* Event Highlights Photo Gallery */}
              <fieldset className="pe-fieldset">
                <legend>Past Event Highlights</legend>
                <p className="pe-help" style={{ marginTop: "-0.5rem", marginBottom: "0.5rem" }}>
                  Add memorable moments, crowd photos, or performer highlights from your previous gatherings.
                </p>

                {highlights.length > 0 && (
                  <div className="pe-highlights-grid">
                    {highlights.map((hl) => (
                      <div className="pe-highlight-card" key={hl.id}>
                        <img src={hl.url} alt={hl.caption || "Event highlight"} />
                        <div className="pe-highlight-meta">
                          <p>{hl.caption || "No caption"}</p>
                          <button
                            type="button"
                            onClick={() => handleRemoveHighlight(hl.id)}
                            aria-label="Remove highlight"
                          >
                            <Trash2 size={13} aria-hidden="true" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {addingHighlight ? (
                  <div className="pe-add-highlight-box">
                    <input
                      type="url"
                      placeholder="Photo image URL (https://...)"
                      value={newHighlightUrl}
                      onChange={(e) => setNewHighlightUrl(e.target.value)}
                    />
                    <input
                      type="text"
                      placeholder="Caption (e.g. Packed rooftop at our Summer Jam)"
                      maxLength={160}
                      value={newHighlightCaption}
                      onChange={(e) => setNewHighlightCaption(e.target.value)}
                    />
                    <div className="pe-add-highlight-actions">
                      <button
                        type="button"
                        className="pe-btn-upload"
                        onClick={handleAddHighlight}
                      >
                        Add to highlights
                      </button>
                      <button
                        type="button"
                        className="pe-btn-remove"
                        onClick={() => {
                          setAddingHighlight(false);
                          setNewHighlightUrl("");
                          setNewHighlightCaption("");
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="pe-add-highlight-trigger"
                    onClick={() => setAddingHighlight(true)}
                  >
                    <Plus size={14} aria-hidden="true" /> Add event highlight photo
                  </button>
                )}
              </fieldset>

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
                      <span>Support phone / WhatsApp</span>
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
              <div className="pe-submit-row">
                <button
                  type="submit"
                  disabled={saving}
                  className="pe-submit"
                >
                  <Save size={16} aria-hidden="true" />
                  <span>{saving ? "Saving…" : "Save profile changes"}</span>
                </button>

                <button
                  type="button"
                  className="pe-preview-trigger-btn"
                  onClick={() => setShowLiveDrawer(true)}
                >
                  <Eye size={16} aria-hidden="true" />
                  <span>Live preview</span>
                </button>
              </div>

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
                  Changes are live immediately ·{" "}
                  <a
                    href={profileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: "var(--accent)" }}
                  >
                    Open public page ↗
                  </a>
                </span>
              </div>
            </form>
          </section>
        </div>
      </div>

      {/* Live Profile Preview Modal */}
      {showLiveDrawer && (
        <div className="pe-modal-backdrop" onClick={() => setShowLiveDrawer(false)}>
          <div
            className="pe-modal-card"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Live Profile Preview"
          >
            <div className="pe-modal-header">
              <div>
                <h3>Live Profile Preview</h3>
                <p className="pe-help">See how attendees see your brand right now</p>
              </div>
              <button
                type="button"
                className="pe-modal-close"
                onClick={() => setShowLiveDrawer(false)}
                aria-label="Close preview"
              >
                <X size={18} aria-hidden="true" />
              </button>
            </div>

            <div className="pe-modal-body">
              {/* Preview Hero */}
              <div
                className="pe-modal-hero"
                style={{
                  background: coverKey
                    ? undefined
                    : "radial-gradient(ellipse at 15% 20%, var(--scrim-soft) 0%, transparent 70%), linear-gradient(135deg, var(--art-poster-dark) 0%, var(--surface-raised) 100%)",
                }}
              >
                {coverKey && (
                  <img
                    src={coverKey}
                    alt="Cover"
                    className="pe-modal-cover"
                    style={{ objectPosition: coverPosition }}
                  />
                )}
                <div className="pe-modal-scrim" />
                <div className="pe-modal-hero-content">
                  <div className="pe-modal-logo">
                    {logoKey ? (
                      <img src={logoKey} alt={orgName} />
                    ) : (
                      <span>{orgName.charAt(0)}</span>
                    )}
                  </div>
                  <div>
                    <h2>{orgName}</h2>
                    {tagline && <p>{tagline}</p>}
                  </div>
                </div>
              </div>

              {/* Preview Bio & Socials */}
              {bio && (
                <div className="pe-modal-section">
                  <h4>About</h4>
                  <p>{bio}</p>
                </div>
              )}

              {highlights.length > 0 && (
                <div className="pe-modal-section">
                  <h4>Highlights ({highlights.length})</h4>
                  <div className="pe-modal-highlights">
                    {highlights.map((hl) => (
                      <div key={hl.id} className="pe-modal-highlight-item">
                        <img src={hl.url} alt={hl.caption || "Highlight"} />
                        {hl.caption && <small>{hl.caption}</small>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {(supportEmail || supportPhone) && (
                <div className="pe-modal-section">
                  <h4>Contact</h4>
                  <p>
                    {[supportEmail, supportPhone].filter(Boolean).join(" · ")}
                  </p>
                </div>
              )}
            </div>

            <div className="pe-modal-footer">
              <span className="pe-help">Previewing unsaved draft</span>
              <button
                type="button"
                className="pe-submit"
                onClick={() => setShowLiveDrawer(false)}
              >
                Done previewing
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
