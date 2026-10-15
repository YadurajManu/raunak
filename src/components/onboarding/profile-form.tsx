"use client";
import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { countries } from "@/config/countries";
import { APP_NAME } from "@/lib/constants";
import { authNextPath } from "@/lib/auth-next";
import { ThemeToggle } from "@/components/marketing/footer";
import type { Place } from "@/server/location/service";

const LocationMap = dynamic(() => import("./location-map"), {
  ssr: false,
  loading: () => <div className="r-map r-map-loading">Unfolding the map…</div>,
});
export type ProfileValues = {
  name: string;
  phone: string;
  gender: string | null;
  location:
    | (Omit<Place, "latitude" | "longitude"> & {
        latitude?: number;
        longitude?: number;
        saveExact: boolean;
      })
    | null;
};
const genders = [
  { value: "FEMALE", label: "Female" },
  { value: "MALE", label: "Male" },
  { value: "NON_BINARY", label: "Non-binary" },
  { value: "OTHER", label: "Another identity" },
  { value: "PREFER_NOT_TO_SAY", label: "Prefer not to say" },
];
export function ProfileForm({
  initial,
  next = "/account",
  editing = false,
}: {
  initial: ProfileValues;
  next?: string;
  editing?: boolean;
}) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [values, setValues] = useState(initial);
  const [mapOpen, setMapOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [places, setPlaces] = useState<Place[]>([]);
  const [point, setPoint] = useState<{
    latitude: number;
    longitude: number;
  } | null>(
    initial.location?.latitude !== undefined &&
      initial.location.longitude !== undefined
      ? {
          latitude: initial.location.latitude,
          longitude: initial.location.longitude,
        }
      : null,
  );
  const [busy, setBusy] = useState(false);
  const [lookupBusy, setLookupBusy] = useState(false);
  const [error, setError] = useState("");
  const [mapError, setMapError] = useState("");
  const [confirmed, setConfirmed] = useState(Boolean(initial.location));
  const requestId = useRef(0);
  const abort = useRef<AbortController | null>(null);
  const title = useRef<HTMLHeadingElement>(null);
  useEffect(
    () => () => {
      ++requestId.current;
      abort.current?.abort();
    },
    [],
  );
  function go(value: number) {
    setStep(value);
    setError("");
    requestAnimationFrame(() => title.current?.focus());
  }
  async function lookup(body: unknown) {
    abort.current?.abort();
    const controller = new AbortController();
    abort.current = controller;
    const id = ++requestId.current;
    setLookupBusy(true);
    setMapError("");
    try {
      const response = await fetch("/api/location", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.error || "Could not find that place.");
      return id === requestId.current ? (result.places as Place[]) : [];
    } catch (cause) {
      if (!controller.signal.aborted)
        setMapError(
          cause instanceof Error ? cause.message : "Location lookup failed.",
        );
      return [];
    } finally {
      if (id === requestId.current) setLookupBusy(false);
    }
  }
  function select(place: Place) {
    abort.current?.abort();
    ++requestId.current;
    setLookupBusy(false);
    setValues((current) => ({
      ...current,
      location: { ...place, saveExact: false },
    }));
    setPoint({ latitude: place.latitude, longitude: place.longitude });
    setConfirmed(false);
    setPlaces([]);
  }
  async function pick(value: { latitude: number; longitude: number }) {
    setPoint(value);
    setConfirmed(false);
    setValues((current) => ({ ...current, location: null }));
    const results = await lookup({ kind: "reverse", ...value });
    if (results[0])
      setValues((current) => ({
        ...current,
        location: { ...results[0], ...value, saveExact: false },
      }));
  }
  function locate() {
    setMapError("");
    if (!navigator.geolocation) {
      setMapError(
        "This browser does not support location. Search or choose a point instead.",
      );
      return;
    }
    setLookupBusy(true);
    const id = ++requestId.current;
    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (id !== requestId.current) return;
        setMapOpen(true);
        void pick({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
      },
      (cause) => {
        if (id !== requestId.current) return;
        setLookupBusy(false);
        setMapError(
          cause.code === 1
            ? "Location permission was declined. You can search or place a pin instead."
            : "Could not get your location. Search or place a pin instead.",
        );
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  }
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (step === 0) {
      const { parsePhoneNumberFromString } =
        await import("libphonenumber-js/max");
      const phone = parsePhoneNumberFromString(values.phone, {
        defaultCountry: "IN",
        extract: false,
      });
      if (values.name.trim().length < 2 || !phone?.isValid() || phone.ext) {
        setError(
          "Enter your name and a valid mobile number. Include your country code outside India.",
        );
        return;
      }
      go(1);
      return;
    }
    if (step === 1) {
      if (values.location && !confirmed) {
        setError("Confirm your selected location, or skip this step.");
        return;
      }
      go(2);
      return;
    }
    setBusy(true);
    try {
      const response = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.error || "Could not save profile.");
      router.push(authNextPath(next));
      router.refresh();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not save profile.",
      );
      setBusy(false);
    }
  }
  return (
    <main className="r-onboarding">
      <header className="r-onboarding-header">
        <Link href="/" className="m-logo">
          <span className="m-logo-mark" aria-hidden="true">
            ◔
          </span>
          {APP_NAME}
        </Link>
        <ThemeToggle compact />
      </header>
      <div className="r-onboarding-grid">
        <aside className="r-onboarding-aside">
          <p className="m-eyebrow">A LITTLE INTRODUCTION</p>
          <h1>
            A few details.
            <br />A world of
            <br />
            <em className="m-serif">good plans.</em>
          </h1>
          <p>
            One account for every side of the event. Find your next plan today.
            Host your own when you’re ready.
          </p>
          <ol className="r-progress">
            {[
              "A little about you",
              "Your corner of the world",
              "Ready when you are",
            ].map((text, index) => (
              <li
                className={
                  step === index
                    ? "is-active"
                    : step > index
                      ? "is-complete"
                      : ""
                }
                aria-current={step === index ? "step" : undefined}
                key={text}
              >
                <span>{step > index ? "✓" : `0${index + 1}`}</span>
                {text}
              </li>
            ))}
          </ol>
          <div className="r-profile-note">
            <span>↗</span>
            <p>
              Your location and gender stay private. You can change or remove
              them from your profile.
            </p>
          </div>
        </aside>
        <section className="r-onboarding-card">
          <p className="m-mono r-step-label">
            {editing ? "EDIT YOUR PROFILE" : "WELCOME TO THE CREW"} · {step + 1}{" "}
            / 3
          </p>
          <h2 ref={title} tabIndex={-1}>
            {step === 0 ? (
              <>
                Let’s start with <em className="m-serif">you.</em>
              </>
            ) : step === 1 ? (
              <>
                Where’s your{" "}
                <em className="m-serif">{APP_NAME.toLowerCase()}?</em>
              </>
            ) : (
              <>
                Looks like <em className="m-serif">you’re ready.</em>
              </>
            )}
          </h2>
          <p className="r-step-intro">
            {step === 0
              ? "Your name and number help us get your tickets to you."
              : step === 1
                ? "Choose a city for nearby events. Your exact location is optional."
                : "A quick look before you head in."}
          </p>
          <form onSubmit={submit}>
            {step === 0 && (
              <div className="r-profile-fields">
                <label>
                  What should we call you?
                  <input
                    autoComplete="name"
                    name="name"
                    required
                    minLength={2}
                    maxLength={100}
                    value={values.name}
                    onChange={(event) =>
                      setValues({ ...values, name: event.target.value })
                    }
                    placeholder="Your full name"
                  />
                </label>
                <label>
                  Mobile number
                  <input
                    autoComplete="tel"
                    type="tel"
                    name="phone"
                    required
                    maxLength={30}
                    value={values.phone}
                    onChange={(event) =>
                      setValues({ ...values, phone: event.target.value })
                    }
                    placeholder="+91 98765 43210"
                  />
                  <small>
                    Include your country code outside India. This number is not
                    yet verified.
                  </small>
                </label>
                <fieldset>
                  <legend>
                    Gender <span>OPTIONAL</span>
                  </legend>
                  <div className="r-gender-options">
                    {genders.map((gender) => (
                      <label
                        key={gender.value}
                        className={
                          values.gender === gender.value ? "is-selected" : ""
                        }
                      >
                        <input
                          type="radio"
                          name="gender"
                          value={gender.value}
                          checked={values.gender === gender.value}
                          onChange={() =>
                            setValues({ ...values, gender: gender.value })
                          }
                        />
                        {gender.label}
                      </label>
                    ))}
                  </div>
                  <button
                    className="r-quiet-button"
                    type="button"
                    onClick={() => setValues({ ...values, gender: null })}
                  >
                    Clear selection
                  </button>
                </fieldset>
              </div>
            )}
            {step === 1 && (
              <div className="r-location-picker">
                <div
                  className="r-location-search"
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      event.currentTarget.querySelector("button")?.click();
                    }
                  }}
                >
                  <label htmlFor="place-search" className="sr-only">
                    Search for a city or place
                  </label>
                  <input
                    id="place-search"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search a city, area or landmark"
                    maxLength={200}
                  />
                  <button
                    type="button"
                    disabled={lookupBusy || query.trim().length < 3}
                    onClick={async () => {
                      const results = await lookup({ kind: "search", query });
                      setPlaces(results);
                      if (!results.length)
                        setMapError(
                          (current) =>
                            current ||
                            "No places found. Try another search or enter your city below.",
                        );
                    }}
                  >
                    Search ↗
                  </button>
                </div>
                {places.length > 0 && (
                  <ul className="r-place-results">
                    {places.map((place) => (
                      <li key={`${place.latitude}:${place.longitude}`}>
                        <button
                          type="button"
                          onClick={() => {
                            select(place);
                            setMapOpen(true);
                          }}
                        >
                          <b>{place.city || place.label}</b>
                          <span>{place.label}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                <div className="r-location-actions">
                  <button type="button" onClick={locate} disabled={lookupBusy}>
                    ◎ Use my location
                  </button>
                  <button type="button" onClick={() => setMapOpen(!mapOpen)}>
                    {mapOpen ? "Hide map" : "Choose on map ↗"}
                  </button>
                </div>
                {mapOpen ? (
                  <LocationMap point={point} onPick={pick} />
                ) : (
                  <div className="r-map-invitation">
                    <span aria-hidden="true">⌖</span>
                    <p>A pin in your part of the world.</p>
                    <button type="button" onClick={() => setMapOpen(true)}>
                      Open interactive map ↗
                    </button>
                  </div>
                )}
                <p className="r-location-disclosure">
                  Opening the map loads OpenStreetMap tiles. Searching or
                  placing a pin sends that place to Geoapify for address lookup.
                  Browser location is requested only when you tap “Use my
                  location.”
                </p>
                {lookupBusy && (
                  <p role="status" className="r-lookup-status">
                    Finding that corner of the world…
                  </p>
                )}
                {mapError && (
                  <p role="status" className="r-location-error">
                    {mapError}
                  </p>
                )}
                <div className="r-manual-place">
                  <label>
                    City
                    <input
                      value={values.location?.city || ""}
                      onChange={(event) => {
                        setConfirmed(false);
                        setValues((current) => ({
                          ...current,
                          location: {
                            city: event.target.value,
                            region: current.location?.region || "",
                            countryCode: current.location?.countryCode || "IN",
                            label: "",
                            latitude: point?.latitude,
                            longitude: point?.longitude,
                            saveExact: false,
                          },
                        }));
                      }}
                      placeholder="Or enter your city manually"
                      maxLength={120}
                    />
                  </label>
                  <div>
                    <label>
                      State / region
                      <input
                        value={values.location?.region || ""}
                        onChange={(event) => {
                          setConfirmed(false);
                          setValues((current) => ({
                            ...current,
                            location: {
                              city: current.location?.city || "",
                              countryCode:
                                current.location?.countryCode || "IN",
                              ...current.location,
                              saveExact: false,
                              label: "",
                              region: event.target.value,
                            },
                          }));
                        }}
                        maxLength={120}
                      />
                    </label>
                    <label>
                      Country
                      <select
                        value={values.location?.countryCode || "IN"}
                        onChange={(event) => {
                          setConfirmed(false);
                          setValues((current) => ({
                            ...current,
                            location: {
                              city: current.location?.city || "",
                              region: current.location?.region || "",
                              ...current.location,
                              saveExact: false,
                              label: "",
                              countryCode: event.target.value.toUpperCase(),
                            },
                          }));
                        }}
                      >
                        {countries.map((country) => (
                          <option key={country.code} value={country.code}>
                            {country.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                </div>
                {values.location?.city && (
                  <div
                    className={`r-selected-place ${confirmed ? "is-confirmed" : ""}`}
                  >
                    <span>⌖</span>
                    <div>
                      <strong>{values.location.city}</strong>
                      <p>
                        {values.location.label ||
                          [
                            values.location.city,
                            values.location.region,
                            values.location.countryCode,
                          ]
                            .filter(Boolean)
                            .join(", ")}
                      </p>
                      {point && (
                        <small>
                          {point.latitude.toFixed(5)},{" "}
                          {point.longitude.toFixed(5)}
                        </small>
                      )}
                    </div>
                    <button type="button" onClick={() => setConfirmed(true)}>
                      {confirmed ? "Confirmed ✓" : "Confirm location"}
                    </button>
                  </div>
                )}
                {point && values.location?.city && (
                  <label className="r-exact-consent">
                    <input
                      type="checkbox"
                      checked={values.location.saveExact}
                      onChange={(event) =>
                        setValues((current) => ({
                          ...current,
                          location: current.location
                            ? {
                                ...current.location,
                                saveExact: event.target.checked,
                                ...point,
                              }
                            : null,
                        }))
                      }
                    />
                    <span>
                      Save this exact pin to my private profile. Otherwise, save
                      only my city and region.
                    </span>
                  </label>
                )}
                <button
                  type="button"
                  className="r-quiet-button"
                  onClick={() => {
                    abort.current?.abort();
                    ++requestId.current;
                    setLookupBusy(false);
                    setValues({ ...values, location: null });
                    setPoint(null);
                    setConfirmed(false);
                    go(2);
                  }}
                >
                  Skip location for now →
                </button>
                <p className="r-map-attribution">
                  Address data:{" "}
                  <a
                    href="https://www.geoapify.com/"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Geoapify
                  </a>{" "}
                  ·{" "}
                  <a
                    href="https://www.openstreetmap.org/copyright"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    OpenStreetMap contributors
                  </a>
                </p>
              </div>
            )}
            {step === 2 && (
              <div className="r-profile-review">
                <div className="r-review-avatar">
                  {values.name.trim().slice(0, 1).toUpperCase()}
                </div>
                <h3>{values.name}</h3>
                <dl>
                  <div>
                    <dt>Mobile</dt>
                    <dd>{values.phone}</dd>
                  </div>
                  <div>
                    <dt>Gender</dt>
                    <dd>
                      {genders.find((gender) => gender.value === values.gender)
                        ?.label || "Not shared"}
                    </dd>
                  </div>
                  <div>
                    <dt>Location</dt>
                    <dd>
                      {values.location
                        ? `${values.location.city}${values.location.region ? `, ${values.location.region}` : ""}`
                        : "Not shared"}
                    </dd>
                  </div>
                  <div>
                    <dt>Exact pin</dt>
                    <dd>
                      {values.location?.saveExact
                        ? "Saved privately with your permission"
                        : "Not stored"}
                    </dd>
                  </div>
                </dl>
                <p>
                  You can book tickets and host events with this same account.
                </p>
              </div>
            )}
            {error && (
              <p className="r-form-error" role="alert">
                {error}
              </p>
            )}
            <div className="r-onboarding-controls">
              {step > 0 && (
                <button
                  type="button"
                  className="r-quiet-button"
                  onClick={() => go(step - 1)}
                  disabled={busy}
                >
                  ← Back
                </button>
              )}
              <button className="m-button" disabled={busy || lookupBusy}>
                {busy
                  ? "Saving your details…"
                  : step === 2
                    ? editing
                      ? "Save profile ↗"
                      : "Let’s go ↗"
                    : "Continue →"}
              </button>
            </div>
          </form>
        </section>
      </div>
      <footer className="r-onboarding-foot">
        <span>ONE ACCOUNT. EVERY SIDE OF THE EVENT.</span>
        <Link href="/privacy">Your privacy ↗</Link>
      </footer>
    </main>
  );
}
