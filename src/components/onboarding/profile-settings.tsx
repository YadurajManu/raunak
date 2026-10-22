"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Bell,
  Check,
  Download,
  Heart,
  LockKeyhole,
  Mail,
  MessageCircle,
  ShieldCheck,
  Trash2,
  UserRound,
} from "lucide-react";
import {
  getCountries,
  getCountryCallingCode,
  parsePhoneNumberFromString,
  type CountryCode,
} from "libphonenumber-js/max";
import { AvatarEditor } from "./avatar-editor";
import { LocationSearch } from "./location-search";
import { FormField, PageHeader, Section, StickySaveBar } from "@/components/ui";
import type { ProfileValues } from "./profile-form";
import { countries } from "@/config/countries";
import { eventCategories } from "@/config/event-options";
import { discoveryUrl } from "@/lib/discovery";
import "./profile-settings.css";

type Preferences = {
  emailRemindersEnabled: boolean;
  whatsappRemindersEnabled: boolean;
};
type Props = {
  initial: ProfileValues;
  email: string;
  avatarKey: string | null;
  preferences?: Preferences;
  interestCategories?: string[];
  deletionRequestedAt?: string | null;
};
type Security = { providers: string[]; emailVerified: boolean };
const phoneCountries = new Set<string>(getCountries());
const navItems = [
  { key: "profile", label: "Profile", Icon: UserRound },
  { key: "notifications", label: "Notifications", Icon: Bell },
  { key: "privacy", label: "Privacy & security", Icon: ShieldCheck },
] as const;
const emptyLocation: NonNullable<ProfileValues["location"]> = {
  city: "",
  region: "",
  countryCode: "IN",
  label: "",
  saveExact: false,
};
const providerLabel: Record<string, string> = {
  "google.com": "Google",
  password: "Email & password",
  phone: "Phone",
  "apple.com": "Apple",
  "facebook.com": "Facebook",
  "github.com": "GitHub",
};

export function ProfileSettings({
  initial,
  email,
  avatarKey,
  preferences = {
    emailRemindersEnabled: true,
    whatsappRemindersEnabled: false,
  },
  interestCategories = [],
  deletionRequestedAt = null,
}: Props) {
  const router = useRouter(),
    pathname = usePathname(),
    query = useSearchParams();
  const section =
    query.get("section") === "notifications"
      ? "notifications"
      : query.get("section") === "privacy"
        ? "privacy"
        : "profile";
  const initialDisplay = {
    ...initial,
    phone:
      parsePhoneNumberFromString(initial.phone)?.formatNational() ||
      initial.phone,
  };
  const [values, setValues] = useState(initialDisplay),
    [savedValues, setSavedValues] = useState(initialDisplay);
  const [prefs, setPrefs] = useState(preferences),
    [savedPrefs, setSavedPrefs] = useState(preferences);
  const [interests, setInterests] = useState(interestCategories),
    [savedInterests, setSavedInterests] = useState(interestCategories);
  const [avatar, setAvatar] = useState(
    avatarKey?.startsWith("avatars/") ? "/api/profile/avatar" : avatarKey,
  );
  const [phoneCountry, setPhoneCountry] = useState<CountryCode>(
    parsePhoneNumberFromString(initial.phone)?.country || "IN",
  );
  const [savedPhoneCountry, setSavedPhoneCountry] = useState<CountryCode>(
    parsePhoneNumberFromString(initial.phone)?.country || "IN",
  );
  const [validation, setValidation] = useState<{
    name?: string;
    phone?: string;
  }>({});
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [status, setStatus] = useState("");
  const [locationStatus, setLocationStatus] = useState("");
  const [security, setSecurity] = useState<Security | null>(null),
    [securityError, setSecurityError] = useState(""),
    [securityBusy, setSecurityBusy] = useState(true);
  const [securityAttempt, setSecurityAttempt] = useState(0);
  const [privacyBusy, setPrivacyBusy] = useState<
      "export" | "delete" | "reset" | null
    >(null),
    [privacyError, setPrivacyError] = useState(""),
    [privacyStatus, setPrivacyStatus] = useState("");
  const [requestedAt, setRequestedAt] = useState(deletionRequestedAt);
  const form = useRef<HTMLFormElement>(null),
    pickId = useRef(0),
    securityRequest = useRef<AbortController | null>(null);
  const profileDirty =
      JSON.stringify(values) !== JSON.stringify(savedValues) ||
      phoneCountry !== savedPhoneCountry,
    prefsDirty = JSON.stringify(prefs) !== JSON.stringify(savedPrefs),
    interestsDirty =
      JSON.stringify(interests) !== JSON.stringify(savedInterests);
  const dirty = profileDirty || prefsDirty || interestsDirty;
  const place = values.location || emptyLocation;
  const selectedTitle = navItems.find((item) => item.key === section)!.label;
  function change(patch: Partial<ProfileValues>) {
    setValues((current) => ({ ...current, ...patch }));
    setStatus("");
    setError("");
    setValidation((current) => ({
      ...current,
      ...("name" in patch ? { name: undefined } : {}),
      ...("phone" in patch ? { phone: undefined } : {}),
    }));
  }
  function location(patch: Partial<NonNullable<ProfileValues["location"]>>) {
    ++pickId.current;
    setValues((current) => ({
      ...current,
      location: { ...(current.location || emptyLocation), ...patch },
    }));
    setLocationStatus("");
    setStatus("");
    setError("");
  }
  async function pick(point: { latitude: number; longitude: number }) {
    const id = ++pickId.current;
    setValues((current) => ({
      ...current,
      location: { ...(current.location || emptyLocation), ...point },
    }));
    setLocationStatus("Finding the address for your pin…");
    try {
      const response = await fetch("/api/location", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "reverse", ...point }),
      });
      const result = await response.json();
      if (id !== pickId.current) return;
      if (!response.ok || !result.places?.[0]) throw new Error();
      setValues((current) => ({
        ...current,
        location: {
          ...result.places[0],
          ...point,
          saveExact: current.location?.saveExact || false,
        },
      }));
      setLocationStatus(
        "Pin updated. Your precise location is only stored if you opt in below.",
      );
    } catch {
      if (id === pickId.current)
        setLocationStatus(
          "Pin selected. Enter your city to save this location.",
        );
    }
  }
  useEffect(() => {
    function unload(event: BeforeUnloadEvent) {
      if (dirty) {
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
        event.altKey ||
        event.shiftKey
      )
        return;
      const anchor = (event.target as Element).closest<HTMLAnchorElement>(
        "a[href]",
      );
      if (
        !anchor ||
        anchor.target === "_blank" ||
        anchor.hasAttribute("download")
      )
        return;
      const next = new URL(anchor.href, window.location.origin);
      if (next.origin !== window.location.origin || next.pathname === pathname)
        return;
      if (!confirm("Leave without saving your account changes?")) {
        event.preventDefault();
        event.stopPropagation();
      }
    }
    function shortcut(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        if (dirty && !busy) form.current?.requestSubmit();
      }
    }
    window.addEventListener("beforeunload", unload);
    document.addEventListener("click", navigate, true);
    document.addEventListener("keydown", shortcut);
    return () => {
      window.removeEventListener("beforeunload", unload);
      document.removeEventListener("click", navigate, true);
      document.removeEventListener("keydown", shortcut);
    };
  }, [dirty, busy, pathname]);
  useEffect(() => {
    if (section !== "privacy" || security) return;
    const controller = new AbortController();
    securityRequest.current = controller;
    async function load() {
      try {
        const response = await fetch("/api/profile/security", {
          signal: controller.signal,
        });
        const result = await response.json();
        if (!response.ok)
          throw new Error(result.error || "Could not load sign-in details.");
        setSecurity(result);
      } catch (cause) {
        if (!controller.signal.aborted)
          setSecurityError(
            cause instanceof Error
              ? cause.message
              : "Could not load sign-in details.",
          );
      } finally {
        if (!controller.signal.aborted) setSecurityBusy(false);
      }
    }
    void load();
    return () => controller.abort();
  }, [section, security, securityAttempt]);
  async function patch(body: unknown) {
    const response = await fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const result = await response.json();
    if (!response.ok)
      throw new Error(
        result.error || "Could not save your changes. Please try again.",
      );
    return result;
  }
  async function save(event: FormEvent) {
    event.preventDefault();
    if (!dirty || busy) return;
    setError("");
    setStatus("");
    const phone = parsePhoneNumberFromString(values.phone, {
      defaultCountry: phoneCountry,
      extract: false,
    });
    const issues = {
      name:
        profileDirty && values.name.trim().length < 2
          ? "Enter your full name using at least 2 characters."
          : undefined,
      phone:
        profileDirty && (!phone?.isValid() || phone.ext)
          ? "Enter a valid phone number for the selected country."
          : undefined,
    };
    if (issues.name || issues.phone) {
      setValidation(issues);
      setError("Review the highlighted personal details before saving.");
      router.replace(`${pathname}`, { scroll: false });
      return;
    }
    setBusy(true);
    try {
      if (profileDirty) {
        const normalized = {
          ...values,
          name: values.name.trim(),
          phone: phone!.number,
          location: place.city.trim()
            ? { ...place, city: place.city.trim() }
            : null,
        };
        await patch(normalized);
        const display = { ...normalized, phone: phone!.formatNational() };
        setValues(display);
        setSavedValues(display);
        setPhoneCountry(phone!.country || phoneCountry);
        setSavedPhoneCountry(phone!.country || phoneCountry);
      }
      if (prefsDirty) {
        await patch(prefs);
        setSavedPrefs(prefs);
        window.dispatchEvent(
          new CustomEvent("raunak:preferences", { detail: prefs }),
        );
      }
      if (interestsDirty) {
        const result = await patch({ interestCategories: interests });
        const accepted = result.interestCategories || interests;
        setInterests(accepted);
        setSavedInterests(accepted);
      }
      setStatus("Your changes are saved.");
      router.refresh();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Could not save your changes. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  function discard() {
    ++pickId.current;
    setValues(savedValues);
    setPrefs(savedPrefs);
    setInterests(savedInterests);
    setPhoneCountry(savedPhoneCountry);
    setError("");
    setValidation({});
    setLocationStatus("");
    setStatus(
      "Unsaved changes discarded. Your profile photo is saved separately.",
    );
  }
  async function downloadData() {
    setPrivacyBusy("export");
    setPrivacyError("");
    setPrivacyStatus("");
    try {
      const response = await fetch("/api/profile/privacy");
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Could not download your data.");
      }
      const url = URL.createObjectURL(await response.blob());
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "raunak-account-data.json";
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setPrivacyStatus("Your account data download is ready.");
    } catch (cause) {
      setPrivacyError(
        cause instanceof Error
          ? cause.message
          : "Could not download your data.",
      );
    } finally {
      setPrivacyBusy(null);
    }
  }
  async function requestDeletion() {
    if (
      !confirm(
        "Request deletion of your Raunak account? Our team will review the request and contact you. Your account and bookings will not be deleted immediately.",
      )
    )
      return;
    setPrivacyBusy("delete");
    setPrivacyError("");
    setPrivacyStatus("");
    try {
      const response = await fetch("/api/profile/privacy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(
          data.error || "Could not submit your request. Please try again.",
        );
      setRequestedAt(data.requestedAt);
      setPrivacyStatus(
        "Deletion request received. Our team will review it and contact you by email.",
      );
    } catch (cause) {
      setPrivacyError(
        cause instanceof Error
          ? cause.message
          : "Could not submit your request.",
      );
    } finally {
      setPrivacyBusy(null);
    }
  }
  async function resetPassword() {
    setPrivacyBusy("reset");
    setPrivacyError("");
    setPrivacyStatus("");
    try {
      const [{ sendPasswordResetEmail }, { getClientAuth }] = await Promise.all(
        [import("firebase/auth"), import("@/lib/firebase-client")],
      );
      await sendPasswordResetEmail(await getClientAuth(), email);
      setPrivacyStatus(
        "Password reset email requested. Check your inbox and spam folder.",
      );
    } catch {
      setPrivacyError(
        "Could not request a reset email. Please try again or contact support.",
      );
    } finally {
      setPrivacyBusy(null);
    }
  }
  return (
    <main className="personal-settings">
      <aside className="personal-rail">
        <nav aria-label="Account settings">
          {navItems.map(({ key, label, Icon }) => (
            <Link
              key={key}
              href={`${pathname}${key === "profile" ? "" : `?section=${key}`}`}
              scroll={false}
              aria-current={section === key ? "page" : undefined}
            >
              <Icon size={16} aria-hidden="true" />
              {label}
            </Link>
          ))}
        </nav>
        <Link href="/account" className="personal-plans-link">
          ← Back to my plans
        </Link>
      </aside>
      <div className="personal-main">
        <PageHeader
          title={selectedTitle}
          description={
            section === "profile"
              ? "Your details, photo and city, all in one place."
              : section === "notifications"
                ? "Choose how you hear about your upcoming events."
                : "Manage your sign-in details and personal data."
          }
        />
        <div className="personal-status" role="status" aria-live="polite">
          {status}
        </div>
        {error && (
          <p className="personal-error" role="alert">
            {error}
          </p>
        )}
        <form id="personal-settings-form" ref={form} onSubmit={save} noValidate>
          <fieldset disabled={busy} className="personal-fields">
            <div hidden={section !== "profile"}>
              <section
                className="personal-photo"
                aria-labelledby="personal-photo-heading"
              >
                <div>
                  <h2 id="personal-photo-heading">Profile photo</h2>
                  <p>Photo changes are saved immediately.</p>
                </div>
                <AvatarEditor
                  src={avatar}
                  name={values.name || "You"}
                  disabled={busy}
                  onSaved={setAvatar}
                />
              </section>
              <Section title="Personal details" id="personal-details">
                <FormField
                  label="Full name"
                  htmlFor="personal-name"
                  error={validation.name}
                >
                  <input
                    id="personal-name"
                    autoComplete="name"
                    required
                    minLength={2}
                    maxLength={100}
                    value={values.name}
                    aria-invalid={Boolean(validation.name)}
                    aria-describedby={
                      validation.name ? "personal-name-error" : undefined
                    }
                    onChange={(event) => change({ name: event.target.value })}
                  />
                </FormField>
                <FormField
                  label="Sign-in email"
                  htmlFor="personal-email"
                  hint="Your sign-in address is managed by your login provider."
                >
                  <div className="personal-email">
                    <LockKeyhole size={16} aria-hidden="true" />
                    <input
                      id="personal-email"
                      type="email"
                      value={email}
                      readOnly
                      aria-readonly="true"
                    />
                  </div>
                </FormField>
                <FormField
                  label="Mobile number"
                  htmlFor="personal-phone"
                  hint="Used for booking updates. WhatsApp delivery also needs your booking consent."
                  error={validation.phone}
                >
                  <div className="personal-phone">
                    <label className="sr-only" htmlFor="personal-phone-country">
                      Phone country
                    </label>
                    <select
                      id="personal-phone-country"
                      value={phoneCountry}
                      onChange={(event) => {
                        const current = parsePhoneNumberFromString(
                          values.phone,
                          phoneCountry,
                        );
                        setPhoneCountry(event.target.value as CountryCode);
                        change({
                          phone: current?.nationalNumber || values.phone,
                        });
                      }}
                    >
                      {countries
                        .filter((country) => phoneCountries.has(country.code))
                        .map((country) => (
                          <option key={country.code} value={country.code}>
                            {country.name} +
                            {getCountryCallingCode(country.code as CountryCode)}
                          </option>
                        ))}
                    </select>
                    <input
                      id="personal-phone"
                      type="tel"
                      autoComplete="tel"
                      required
                      maxLength={30}
                      value={values.phone}
                      aria-invalid={Boolean(validation.phone)}
                      aria-describedby={`personal-phone-hint${validation.phone ? " personal-phone-error" : ""}`}
                      onChange={(event) =>
                        change({ phone: event.target.value })
                      }
                      onBlur={() => {
                        const number = parsePhoneNumberFromString(
                          values.phone,
                          phoneCountry,
                        );
                        if (number?.isValid()) {
                          if (number.country) setPhoneCountry(number.country);
                          change({ phone: number.formatNational() });
                        }
                      }}
                    />
                  </div>
                </FormField>
                <FormField label="Gender (optional)" htmlFor="personal-gender">
                  <select
                    id="personal-gender"
                    value={values.gender || ""}
                    onChange={(event) =>
                      change({ gender: event.target.value || null })
                    }
                  >
                    <option value="">Prefer not to specify</option>
                    <option value="FEMALE">Female</option>
                    <option value="MALE">Male</option>
                    <option value="NON_BINARY">Non-binary</option>
                    <option value="OTHER">Another identity</option>
                    <option value="PREFER_NOT_TO_SAY">Prefer not to say</option>
                  </select>
                </FormField>
              </Section>
              <Section
                title="Location"
                description="Choose a city for discovery. You can always explore other places."
                id="personal-location"
              >
                <LocationSearch
                  live
                  locate
                  value={place.city}
                  onChange={(city) =>
                    location({
                      city,
                      region: "",
                      label: "",
                      latitude: undefined,
                      longitude: undefined,
                      saveExact: false,
                    })
                  }
                  onSelect={(selected) =>
                    location({ ...selected, saveExact: false })
                  }
                  point={
                    place.latitude !== undefined &&
                    place.longitude !== undefined
                      ? { latitude: place.latitude, longitude: place.longitude }
                      : null
                  }
                  onPick={pick}
                />
                {place.city && (
                  <button
                    type="button"
                    className="personal-text-button"
                    onClick={() => {
                      ++pickId.current;
                      change({ location: null });
                      setLocationStatus(
                        "Location cleared. Save changes to remove it from your account.",
                      );
                    }}
                  >
                    Clear location
                  </button>
                )}
                {place.label && (
                  <p className="personal-resolved">{place.label}</p>
                )}
                <div className="personal-row">
                  <FormField label="State / region" htmlFor="personal-region">
                    <input
                      id="personal-region"
                      autoComplete="address-level1"
                      maxLength={120}
                      value={place.region}
                      onChange={(event) =>
                        location({ region: event.target.value })
                      }
                    />
                  </FormField>
                  <FormField label="Country" htmlFor="personal-country">
                    <select
                      id="personal-country"
                      value={place.countryCode}
                      onChange={(event) =>
                        location({
                          countryCode: event.target.value,
                          latitude: undefined,
                          longitude: undefined,
                          saveExact: false,
                        })
                      }
                    >
                      {countries.map((country) => (
                        <option key={country.code} value={country.code}>
                          {country.name}
                        </option>
                      ))}
                    </select>
                  </FormField>
                </div>
                {place.latitude !== undefined &&
                  place.longitude !== undefined && (
                    <label className="personal-choice">
                      <input
                        type="checkbox"
                        checked={place.saveExact}
                        onChange={(event) =>
                          location({ saveExact: event.target.checked })
                        }
                      />
                      <span>
                        Save this precise pin privately.
                        <small>
                          Off by default. Otherwise, only your city is stored.
                        </small>
                      </span>
                    </label>
                  )}
                <p className="personal-help" role="status">
                  {locationStatus}
                </p>
              </Section>
              <Section
                title="Your interests"
                description="Pick the kinds of events you enjoy. This will not hide other events."
                id="personal-interests"
              >
                <div
                  className="personal-interests"
                  role="group"
                  aria-label="Event interests"
                >
                  {eventCategories.map((category) => (
                    <button
                      type="button"
                      key={category}
                      aria-pressed={interests.includes(category)}
                      onClick={() => {
                        setInterests((current) =>
                          current.includes(category)
                            ? current.filter((value) => value !== category)
                            : [...current, category],
                        );
                        setStatus("");
                        setError("");
                      }}
                    >
                      {interests.includes(category) && (
                        <Check size={14} aria-hidden="true" />
                      )}
                      {category}
                    </button>
                  ))}
                </div>
                {interests.length > 0 && (
                  <Link
                    className="personal-explore"
                    href={discoveryUrl({ category: interests.join("|") })}
                  >
                    <Heart size={16} aria-hidden="true" /> Explore selected
                    interests →
                  </Link>
                )}
              </Section>
            </div>
            <div hidden={section !== "notifications"}>
              <Section
                title="Event reminders"
                description="Choose a channel for reminders before your events. Save changes to apply your choices."
              >
                <label className="personal-choice">
                  <Mail size={18} aria-hidden="true" />
                  <span>
                    Email reminders
                    <small>Get a reminder before your event begins.</small>
                  </span>
                  <input
                    type="checkbox"
                    checked={prefs.emailRemindersEnabled}
                    onChange={(event) => {
                      setPrefs((current) => ({
                        ...current,
                        emailRemindersEnabled: event.target.checked,
                      }));
                      setStatus("");
                    }}
                  />
                </label>
                <label className="personal-choice">
                  <MessageCircle size={18} aria-hidden="true" />
                  <span>
                    WhatsApp reminders
                    <small>
                      Requires your phone number and WhatsApp consent at
                      booking.
                    </small>
                  </span>
                  <input
                    type="checkbox"
                    checked={prefs.whatsappRemindersEnabled}
                    onChange={(event) => {
                      setPrefs((current) => ({
                        ...current,
                        whatsappRemindersEnabled: event.target.checked,
                      }));
                      setStatus("");
                    }}
                  />
                </label>
                <p className="personal-help">
                  Booking confirmations, tickets and important event updates
                  continue through the permitted delivery channels. These
                  switches control reminders only.
                </p>
              </Section>
            </div>
          </fieldset>
        </form>
        <div hidden={section !== "privacy"}>
          <Section title="Sign-in & security">
            <FormField label="Sign-in email" htmlFor="security-email">
              <input id="security-email" value={email} readOnly />
            </FormField>
            {securityBusy && <p role="status">Loading sign-in details…</p>}
            {securityError && (
              <div>
                <p className="personal-error" role="alert">
                  {securityError}
                </p>
                <button
                  type="button"
                  className="ui-button"
                  onClick={() => {
                    setSecurityBusy(true);
                    setSecurityError("");
                    setSecurityAttempt((current) => current + 1);
                  }}
                >
                  Retry sign-in details
                </button>
              </div>
            )}
            {security && (
              <>
                <dl className="personal-security-details">
                  <div>
                    <dt>Connected sign-in methods</dt>
                    <dd>
                      {security.providers.length
                        ? security.providers.map((provider) => (
                            <span key={provider}>
                              {providerLabel[provider] || "Connected provider"}
                            </span>
                          ))
                        : "No provider details available"}
                    </dd>
                  </div>
                  <div>
                    <dt>Email status</dt>
                    <dd>
                      {security.emailVerified
                        ? "Verified by your sign-in provider"
                        : "Not marked verified by your sign-in provider"}
                    </dd>
                  </div>
                </dl>
                {security.providers.includes("password") && (
                  <button
                    type="button"
                    className="ui-button"
                    disabled={Boolean(privacyBusy)}
                    onClick={resetPassword}
                  >
                    Send password reset email
                  </button>
                )}
                <p className="personal-help">
                  For provider accounts, manage your password and sign-in
                  security with that provider. Changing your sign-in email is
                  not supported here.
                </p>
              </>
            )}
          </Section>
          <Section title="Your data">
            <p>
              Your precise location is saved only when you choose to save a pin.
              Remove it in the Location section and save your changes.
            </p>
            <Link href={pathname} className="personal-explore">
              Manage saved location →
            </Link>
            <div className="personal-data-action">
              <div>
                <h3>Download account data</h3>
                <p>
                  Get your profile, preferences and booking summaries as JSON.
                  Private QR codes and sign-in secrets are excluded.
                </p>
              </div>
              <button
                type="button"
                className="ui-button"
                disabled={Boolean(privacyBusy)}
                onClick={downloadData}
              >
                <Download size={16} aria-hidden="true" />
                {privacyBusy === "export" ? "Preparing…" : "Download data"}
              </button>
            </div>
          </Section>
          <Section title="Account deletion">
            <p>
              Requests are reviewed by our team. Your account stays active while
              we review the request; booking and payment records may need to be
              retained.
            </p>
            {requestedAt && (
              <p className="personal-pending">
                Request received{" "}
                {new Date(requestedAt).toLocaleDateString("en-IN", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                  timeZone: "Asia/Kolkata",
                })}
                . You can submit again if you need our team to check the
                notification.
              </p>
            )}
            <button
              type="button"
              className="ui-button personal-delete"
              disabled={Boolean(privacyBusy)}
              onClick={requestDeletion}
            >
              <Trash2 size={16} aria-hidden="true" />
              {privacyBusy === "delete"
                ? "Sending request…"
                : requestedAt
                  ? "Check deletion request"
                  : "Request account deletion"}
            </button>
            <Link href="/contact" className="personal-explore">
              Contact support →
            </Link>
          </Section>
          <div role="status" className="personal-status">
            {privacyStatus}
          </div>
          {privacyError && (
            <p className="personal-error" role="alert">
              {privacyError}
            </p>
          )}
        </div>
        <StickySaveBar
          dirty={dirty}
          busy={busy}
          onDiscard={discard}
          formId="personal-settings-form"
        />
      </div>
    </main>
  );
}
