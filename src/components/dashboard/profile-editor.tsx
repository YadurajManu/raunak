"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowDown,
  ArrowUp,
  Check,
  Copy,
  Eye,
  ImagePlus,
  Link2,
  Mail,
  Phone,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import {
  FormField,
  ImageField,
  InitialsAvatar,
  PageHeader,
  Section,
  SegmentedControl,
  SettingsNavigation,
  StickySaveBar,
} from "@/components/ui";
import "./profile-editor.css";
type SocialLinks = {
  instagram?: string;
  twitter?: string;
  youtube?: string;
  website?: string;
  linkedin?: string;
};
type HighlightItem = { id: string; url: string; caption?: string };
type Draft = {
  tagline: string;
  bio: string;
  socialLinks: SocialLinks;
  supportEmail: string;
  supportPhone: string;
  profileVisible: boolean;
  coverPosition: string;
  highlights: HighlightItem[];
};
type ProfileEditorProps = {
  orgId: string;
  orgSlug: string;
  orgName: string;
  readOnly?: boolean;
  initial: Omit<Draft, "coverPosition" | "highlights"> & {
    logoKey?: string;
    coverKey?: string;
    coverPosition?: string;
    highlights?: HighlightItem[];
  };
};
const socialFields = [
  { key: "website", label: "Website" },
  { key: "instagram", label: "Instagram" },
  { key: "twitter", label: "X / Twitter" },
  { key: "youtube", label: "YouTube" },
  { key: "linkedin", label: "LinkedIn" },
] as const;

export function ProfileEditor({
  orgId,
  orgSlug,
  orgName,
  initial,
  readOnly = false,
}: ProfileEditorProps) {
  const router = useRouter();
  const initialDraft: Draft = {
    tagline: initial.tagline,
    bio: initial.bio,
    socialLinks: initial.socialLinks,
    supportEmail: initial.supportEmail,
    supportPhone: initial.supportPhone,
    profileVisible: initial.profileVisible,
    coverPosition: initial.coverPosition || "center",
    highlights: initial.highlights || [],
  };
  const [draft, setDraft] = useState(initialDraft),
    [baseline, setBaseline] = useState(initialDraft);
  const [logo, setLogo] = useState(
      initial.logoKey ? `/api/orgs/${orgId}/logo` : "",
    ),
    [cover, setCover] = useState(
      initial.coverKey ? `/api/orgs/${orgId}/cover` : "",
    );
  const [device, setDevice] = useState("desktop"),
    [saving, setSaving] = useState(false),
    [status, setStatus] = useState(""),
    [error, setError] = useState("");
  const [upload, setUpload] = useState<{
    kind: "logo" | "cover";
    progress: number;
    processing: boolean;
  } | null>(null);
  const [uploadError, setUploadError] = useState<{
    kind: "logo" | "cover";
    message: string;
    retry?: boolean;
  } | null>(null);
  const [removing, setRemoving] = useState(false),
    [highlightUrl, setHighlightUrl] = useState(""),
    [highlightCaption, setHighlightCaption] = useState("");
  const formRef = useRef<HTMLFormElement>(null),
    dialogRef = useRef<HTMLDialogElement>(null),
    previewButtonRef = useRef<HTMLButtonElement>(null);
  const fileRef = useRef<{ kind: "logo" | "cover"; file: File } | null>(null),
    xhrRef = useRef<XMLHttpRequest | null>(null);
  const dirty = !readOnly && JSON.stringify(draft) !== JSON.stringify(baseline),
    busy = saving || Boolean(upload) || removing;
  const publicPath = `/organizers/${orgSlug}`;
  const checklist = [
    { label: "Logo", done: Boolean(logo), href: "#profile-images" },
    { label: "Cover photo", done: Boolean(cover), href: "#profile-images" },
    {
      label: "Tagline",
      done: Boolean(draft.tagline.trim()),
      href: "#profile-tagline",
    },
    {
      label: "About your community",
      done: Boolean(draft.bio.trim()),
      href: "#profile-bio",
    },
    {
      label: "Contact details",
      done: Boolean(draft.supportEmail || draft.supportPhone),
      href: "#profile-contact",
    },
    {
      label: "Website or social link",
      done: Object.values(draft.socialLinks).some(Boolean),
      href: "#profile-contact",
    },
  ];
  const complete = Math.round(
    (checklist.filter((item) => item.done).length / checklist.length) * 100,
  );
  function update<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
    setStatus("");
    setError("");
  }
  useEffect(() => {
    function leave(event: BeforeUnloadEvent) {
      if (dirty || upload) {
        event.preventDefault();
        event.returnValue = "";
      }
    }
    function navigate(event: MouseEvent) {
      if (
        !dirty ||
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      )
        return;
      const link = (event.target as Element).closest<HTMLAnchorElement>(
        "a[href]",
      );
      if (!link || link.target === "_blank" || link.hasAttribute("download"))
        return;
      const target = new URL(link.href, location.href);
      if (
        target.origin !== location.origin ||
        (target.pathname === location.pathname &&
          target.search === location.search)
      )
        return;
      if (!window.confirm("Leave without saving your profile changes?")) {
        event.preventDefault();
        event.stopPropagation();
      }
    }
    function shortcut(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        if (dirty && !busy) formRef.current?.requestSubmit();
      }
    }
    window.addEventListener("beforeunload", leave);
    document.addEventListener("click", navigate, true);
    document.addEventListener("keydown", shortcut);
    return () => {
      window.removeEventListener("beforeunload", leave);
      document.removeEventListener("click", navigate, true);
      document.removeEventListener("keydown", shortcut);
    };
  }, [dirty, busy, upload]);
  useEffect(() => () => xhrRef.current?.abort(), []);
  async function save(event: FormEvent) {
    event.preventDefault();
    if (readOnly || busy || !dirty) return;
    setSaving(true);
    setError("");
    setStatus("");
    const payload = {
      ...draft,
      tagline: draft.tagline.trim(),
      bio: draft.bio.trim(),
      supportEmail: draft.supportEmail.trim(),
      supportPhone: draft.supportPhone.trim(),
    };
    try {
      const response = await fetch(`/api/orgs/${orgId}/profile`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(
          result.error || "Could not save profile. Please try again.",
        );
      setDraft(payload);
      setBaseline(payload);
      setStatus("Profile saved");
      router.refresh();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Could not save profile. Please try again.",
      );
    } finally {
      setSaving(false);
    }
  }
  function discard() {
    setDraft(baseline);
    setHighlightUrl("");
    setHighlightCaption("");
    setError("");
    setStatus("Changes discarded. Uploaded images are already saved.");
  }
  function uploadImage(kind: "logo" | "cover", file: File) {
    if (readOnly || busy) return;
    fileRef.current = { kind, file };
    setUploadError(null);
    setStatus("");
    const limit = kind === "logo" ? 8 : 12;
    if (!file.size || file.size > limit * 1024 * 1024) {
      setUploadError({
        kind,
        message: `Choose an image smaller than ${limit} MB.`,
      });
      return;
    }
    if (!/\.(jpe?g|png|webp|avif|heic|heif)$/i.test(file.name)) {
      setUploadError({
        kind,
        message: "Choose a JPG, PNG, WebP, AVIF or HEIC image.",
      });
      return;
    }
    setUpload({ kind, progress: 0, processing: false });
    const data = new FormData();
    data.append("file", file);
    if (kind === "cover") data.append("position", draft.coverPosition);
    const xhr = new XMLHttpRequest();
    xhrRef.current = xhr;
    xhr.open("POST", `/api/orgs/${orgId}/${kind}`);
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable)
        setUpload({
          kind,
          progress: Math.round((event.loaded / event.total) * 100),
          processing: event.loaded === event.total,
        });
    };
    xhr.onload = () => {
      setUpload(null);
      try {
        const result = JSON.parse(xhr.responseText);
        if (xhr.status < 200 || xhr.status >= 300 || !result.ok)
          throw new Error(result.error || "Upload failed. Please try again.");
        if (kind === "logo") setLogo(result.logoKey);
        else {
          setCover(result.coverKey);
          setBaseline((current) => ({
            ...current,
            coverPosition: draft.coverPosition,
          }));
        }
        setStatus(
          `${kind === "logo" ? "Logo" : "Cover photo"} saved immediately.`,
        );
        fileRef.current = null;
        router.refresh();
      } catch (cause) {
        setUploadError({
          kind,
          message:
            cause instanceof Error
              ? cause.message
              : "Upload failed. Please try again.",
          retry: true,
        });
      }
    };
    xhr.onerror = () => {
      setUpload(null);
      setUploadError({
        kind,
        message: "Connection lost. Check your connection and retry.",
        retry: true,
      });
    };
    xhr.send(data);
  }
  async function removeImage(kind: "logo" | "cover") {
    if (
      readOnly ||
      busy ||
      !confirm(
        `Remove your ${kind === "logo" ? "logo" : "cover photo"}? This is saved immediately.`,
      )
    )
      return;
    setRemoving(true);
    setUploadError(null);
    try {
      const response = await fetch(`/api/orgs/${orgId}/${kind}`, {
        method: "DELETE",
      });
      if (!response.ok)
        throw new Error("Could not remove image. Please try again.");
      if (kind === "logo") setLogo("");
      else setCover("");
      setStatus("Image removed and saved immediately.");
      router.refresh();
    } catch (cause) {
      setUploadError({
        kind,
        message:
          cause instanceof Error ? cause.message : "Could not remove image.",
      });
    } finally {
      setRemoving(false);
    }
  }
  async function copyUrl() {
    try {
      await navigator.clipboard.writeText(
        new URL(publicPath, location.origin).href,
      );
      setStatus("Public profile link copied");
    } catch {
      setError(
        "Could not copy the link. Open the public page to copy its address.",
      );
    }
  }
  function addHighlight() {
    if (!highlightUrl || draft.highlights.length >= 20) return;
    try {
      const url = new URL(highlightUrl);
      if (!["https:", "http:"].includes(url.protocol)) throw new Error();
      update("highlights", [
        ...draft.highlights,
        {
          id: `hl-${crypto.randomUUID()}`,
          url: url.href,
          caption: highlightCaption.trim() || undefined,
        },
      ]);
      setHighlightUrl("");
      setHighlightCaption("");
    } catch {
      setError("Enter a complete image link beginning with https://.");
    }
  }
  function moveHighlight(index: number, direction: number) {
    const next = [...draft.highlights];
    [next[index], next[index + direction]] = [
      next[index + direction],
      next[index],
    ];
    update("highlights", next);
  }
  function closePreview() {
    dialogRef.current?.close();
    previewButtonRef.current?.focus();
  }
  const preview = (
    <div className="pe-preview-content">
      <div className={`pe-preview-cover ${cover ? "has-image" : ""}`}>
        {cover ? (
          <img
            src={cover}
            alt=""
            style={{ objectPosition: draft.coverPosition }}
          />
        ) : (
          <ImagePlus size={28} aria-hidden="true" />
        )}
      </div>
      <div className="pe-preview-identity">
        <InitialsAvatar name={orgName} src={logo} size={56} />
        <div>
          <h3>{orgName}</h3>
          <p>{draft.tagline || "Your community tagline"}</p>
        </div>
      </div>
      <p className="pe-preview-bio">
        {draft.bio || "Tell attendees a little about your community."}
      </p>
      <div className="pe-hosted-preview">
        <span>Hosted by</span>
        <InitialsAvatar name={orgName} src={logo} size={40} />
        <strong>{orgName}</strong>
      </div>
      <Link
        href={publicPath}
        target="_blank"
        rel="noopener noreferrer"
        className="pe-text-link"
      >
        Open public page →
      </Link>
    </div>
  );
  return (
    <main className="pe-page">
      <aside className="pe-rail">
        <SettingsNavigation orgId={orgId} current="profile" />
        <nav className="pe-anchors" aria-label="On this page">
          <h2>On this page</h2>
          {["Images", "About", "Contact and links", "Highlights"].map(
            (name, index) => (
              <a
                key={name}
                href={`#${["profile-images", "profile-about", "profile-contact", "profile-highlights"][index]}`}
              >
                {name}
              </a>
            ),
          )}
        </nav>
        <div className="pe-completeness">
          <h2>
            Profile completeness <span>{complete}%</span>
          </h2>
          <progress
            value={complete}
            max={100}
            aria-label="Profile completeness"
          />
          <ul>
            {checklist.map((item) => (
              <li key={item.label}>
                <a href={item.href}>
                  {item.done ? (
                    <Check size={14} aria-label="Complete" />
                  ) : (
                    <span className="pe-check-empty" aria-hidden="true" />
                  )}
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </aside>
      <div className="pe-main">
        <PageHeader
          title="Organizer profile"
          description="This is what attendees see on your organizer page and event cards."
          backHref={`/dashboard/events?org=${orgId}`}
          backLabel="Workspace events"
          actions={
            <button
              ref={previewButtonRef}
              type="button"
              className="pe-preview-trigger pe-button"
              onClick={() => dialogRef.current?.showModal()}
            >
              <Eye size={16} aria-hidden="true" /> Preview
            </button>
          }
        />
        <div className="pe-public-url">
          <span>raunak.yaduraj.me{publicPath}</span>
          <button
            type="button"
            className="pe-button"
            aria-label="Copy public profile link"
            onClick={copyUrl}
          >
            <Copy size={16} aria-hidden="true" />
          </button>
          <Link
            className="pe-button"
            href={publicPath}
            target="_blank"
            rel="noopener noreferrer"
          >
            Open →
          </Link>
        </div>
        {readOnly && (
          <p className="pe-notice">
            You can view this profile. Only workspace owners and administrators
            can edit it.
          </p>
        )}
        <div role="status" aria-live="polite" className="pe-status">
          {status}
        </div>
        {error && (
          <p role="alert" className="pe-error">
            {error}
          </p>
        )}
        <form id="organizer-profile" ref={formRef} onSubmit={save}>
          <fieldset className="pe-fields" disabled={readOnly || busy}>
            <Section
              title="Images"
              description="Logo and cover changes are saved immediately. Other changes use Save changes."
              id="profile-images"
            >
              <ImageField
                label="Profile photo or logo"
                hint="Square, at least 512 × 512 · JPG, PNG, WebP, AVIF, HEIC · up to 8 MB"
                onFiles={(files) => {
                  if (files[0]) uploadImage("logo", files[0]);
                }}
                busy={busy}
                error={
                  uploadError?.kind === "logo" ? uploadError.message : undefined
                }
              >
                <div className="pe-logo-row">
                  <InitialsAvatar name={orgName} src={logo} size={96} />
                  <span>Drop an image here, or choose a file.</span>
                  {logo && !readOnly && (
                    <button
                      type="button"
                      className="pe-button pe-logo-remove"
                      onClick={() => removeImage("logo")}
                    >
                      <Trash2 size={16} aria-hidden="true" /> Remove logo
                    </button>
                  )}
                </div>
              </ImageField>
              <div className="pe-cover-heading">
                <h3>Cover photo</h3>
                <SegmentedControl
                  label="Cover preview size"
                  value={device}
                  onChange={setDevice}
                  options={[
                    { value: "desktop", label: "Desktop" },
                    { value: "mobile", label: "Mobile" },
                  ]}
                />
              </div>
              <div
                className={`pe-cover ${device === "mobile" ? "pe-cover-mobile" : ""}`}
              >
                <ImageField
                  label={cover ? "Replace cover photo" : "Upload cover photo"}
                  hint="Wide banner · JPG, PNG, WebP, AVIF, HEIC · up to 12 MB"
                  onFiles={(files) => {
                    if (files[0]) uploadImage("cover", files[0]);
                  }}
                  busy={busy}
                  error={
                    uploadError?.kind === "cover"
                      ? uploadError.message
                      : undefined
                  }
                >
                  {cover ? (
                    <img
                      className="pe-cover-image"
                      src={cover}
                      alt="Current cover photo"
                      style={{ objectPosition: draft.coverPosition }}
                    />
                  ) : (
                    <div className="pe-cover-empty">
                      <ImagePlus size={28} aria-hidden="true" />
                      <span>Give your community a cover photo.</span>
                    </div>
                  )}
                </ImageField>
              </div>
              {cover && (
                <div className="pe-cover-tools">
                  <SegmentedControl
                    label="Cover position"
                    value={draft.coverPosition}
                    onChange={(value) => update("coverPosition", value)}
                    options={[
                      { value: "top", label: "Top" },
                      { value: "center", label: "Center" },
                      { value: "bottom", label: "Bottom" },
                    ]}
                  />
                  {!readOnly && (
                    <button
                      type="button"
                      className="pe-button"
                      onClick={() => removeImage("cover")}
                    >
                      <Trash2 size={16} aria-hidden="true" /> Remove cover
                    </button>
                  )}
                </div>
              )}
              {upload && (
                <div className="pe-upload" role="status" aria-live="polite">
                  <span>
                    {upload.processing
                      ? "Processing image…"
                      : `Uploading ${upload.kind} · ${upload.progress}%`}
                  </span>
                  <progress
                    value={upload.progress}
                    max={100}
                    aria-label="Image upload progress"
                  />
                </div>
              )}
              {uploadError?.retry && !readOnly && (
                <button
                  type="button"
                  className="pe-button"
                  onClick={() => {
                    const pending = fileRef.current;
                    if (pending) uploadImage(pending.kind, pending.file);
                  }}
                >
                  Retry upload
                </button>
              )}
            </Section>
            <Section title="About" id="profile-about">
              <FormField
                label="Display name"
                htmlFor="profile-name"
                hint="Your workspace name. Contact a workspace owner to change it."
              >
                <input id="profile-name" value={orgName} readOnly />
              </FormField>
              <FormField
                label="Tagline"
                htmlFor="profile-tagline"
                hint="A short introduction to your community."
                counter={`${draft.tagline.length}/160`}
              >
                <input
                  id="profile-tagline"
                  maxLength={160}
                  value={draft.tagline}
                  onChange={(event) => update("tagline", event.target.value)}
                />
              </FormField>
              <FormField
                label="About / Bio"
                htmlFor="profile-bio"
                hint="What do you host, and who is it for?"
                counter={`${draft.bio.length}/2000`}
              >
                <textarea
                  id="profile-bio"
                  rows={4}
                  maxLength={2000}
                  value={draft.bio}
                  onChange={(event) => {
                    update("bio", event.target.value);
                    event.target.style.height = "auto";
                    event.target.style.height = `${event.target.scrollHeight}px`;
                  }}
                />
              </FormField>
              <label className="pe-checkbox">
                <input
                  type="checkbox"
                  checked={draft.profileVisible}
                  onChange={(event) =>
                    update("profileVisible", event.target.checked)
                  }
                />{" "}
                Show public organizer profile
              </label>
              <p className="pe-help">
                {draft.profileVisible
                  ? "Your organizer profile can be viewed at its public URL."
                  : "Your public organizer profile is hidden."}
              </p>
            </Section>
            <Section
              title="Contact and links"
              description="These contact details and links appear on your public organizer profile."
              id="profile-contact"
            >
              <div className="pe-field-row">
                <FormField label="Support email" htmlFor="profile-email">
                  <div className="pe-input-icon">
                    <Mail size={16} aria-hidden="true" />
                    <input
                      type="email"
                      autoComplete="email"
                      id="profile-email"
                      value={draft.supportEmail}
                      onChange={(event) =>
                        update("supportEmail", event.target.value)
                      }
                    />
                  </div>
                </FormField>
                <FormField label="Support phone" htmlFor="profile-phone">
                  <div className="pe-input-icon">
                    <Phone size={16} aria-hidden="true" />
                    <input
                      type="tel"
                      autoComplete="tel"
                      maxLength={20}
                      id="profile-phone"
                      value={draft.supportPhone}
                      onChange={(event) =>
                        update("supportPhone", event.target.value)
                      }
                    />
                  </div>
                </FormField>
              </div>
              {socialFields.map((field) => (
                <FormField
                  key={field.key}
                  label={field.label}
                  htmlFor={`profile-${field.key}`}
                >
                  <div className="pe-input-icon">
                    <Link2 size={16} aria-hidden="true" />
                    <input
                      type="url"
                      id={`profile-${field.key}`}
                      placeholder="https://"
                      value={draft.socialLinks[field.key] || ""}
                      onChange={(event) =>
                        update("socialLinks", {
                          ...draft.socialLinks,
                          [field.key]: event.target.value,
                        })
                      }
                    />
                  </div>
                </FormField>
              ))}
            </Section>
            <Section
              title="Highlights"
              description="Add up to 20 image links from past events. Changes are saved with your profile."
              id="profile-highlights"
            >
              {draft.highlights.length ? (
                <ol className="pe-highlights">
                  {draft.highlights.map((item, index) => (
                    <li key={item.id}>
                      <img
                        src={item.url}
                        alt={item.caption || `Highlight ${index + 1}`}
                      />
                      <span>{item.caption || `Highlight ${index + 1}`}</span>
                      <div>
                        <button
                          type="button"
                          className="pe-button"
                          aria-label={`Move highlight ${index + 1} up`}
                          disabled={index === 0}
                          onClick={() => moveHighlight(index, -1)}
                        >
                          <ArrowUp size={16} />
                        </button>
                        <button
                          type="button"
                          className="pe-button"
                          aria-label={`Move highlight ${index + 1} down`}
                          disabled={index === draft.highlights.length - 1}
                          onClick={() => moveHighlight(index, 1)}
                        >
                          <ArrowDown size={16} />
                        </button>
                        <button
                          type="button"
                          className="pe-button"
                          aria-label={`Remove highlight ${index + 1}`}
                          onClick={() =>
                            update(
                              "highlights",
                              draft.highlights.filter(
                                (entry) => entry.id !== item.id,
                              ),
                            )
                          }
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="pe-help">
                  No highlights yet. Share a glimpse of your past events.
                </p>
              )}
              {!readOnly && draft.highlights.length < 20 && (
                <div className="pe-add-highlight">
                  <FormField label="Image link" htmlFor="highlight-url">
                    <input
                      id="highlight-url"
                      type="url"
                      value={highlightUrl}
                      onChange={(event) => setHighlightUrl(event.target.value)}
                      placeholder="https://"
                    />
                  </FormField>
                  <FormField
                    label="Caption (optional)"
                    htmlFor="highlight-caption"
                    counter={`${highlightCaption.length}/200`}
                  >
                    <input
                      id="highlight-caption"
                      maxLength={200}
                      value={highlightCaption}
                      onChange={(event) =>
                        setHighlightCaption(event.target.value)
                      }
                    />
                  </FormField>
                  <button
                    type="button"
                    className="pe-button"
                    disabled={!highlightUrl}
                    onClick={addHighlight}
                  >
                    <Upload size={16} aria-hidden="true" /> Add highlight
                  </button>
                </div>
              )}
            </Section>
          </fieldset>
        </form>
        <StickySaveBar
          dirty={dirty}
          busy={busy}
          onDiscard={discard}
          formId="organizer-profile"
          status={error || undefined}
        />
      </div>
      <aside className="pe-live-preview" aria-label="Live organizer preview">
        <h2>How attendees see you</h2>
        {preview}
      </aside>
      <dialog
        className="pe-preview-dialog"
        ref={dialogRef}
        aria-labelledby="profile-preview-title"
        onClick={(event) => {
          if (event.target === event.currentTarget) closePreview();
        }}
        onClose={() => previewButtonRef.current?.focus()}
      >
        <div className="pe-dialog-header">
          <h2 id="profile-preview-title">How attendees see you</h2>
          <button
            type="button"
            className="pe-button"
            aria-label="Close preview"
            onClick={closePreview}
          >
            <X size={18} />
          </button>
        </div>
        {preview}
      </dialog>
    </main>
  );
}
