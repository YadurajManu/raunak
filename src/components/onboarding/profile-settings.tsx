"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { LocationSearch } from "./location-search";
import type { ProfileValues } from "./profile-form";
import { countries } from "@/config/countries";
export function ProfileSettings({
  initial,
  email,
  avatarKey,
}: {
  initial: ProfileValues;
  email: string;
  avatarKey: string | null;
}) {
  const router = useRouter();
  const [values, setValues] = useState(initial);
  const [avatar, setAvatar] = useState(
    avatarKey?.startsWith("avatars/") ? "/api/profile/avatar" : avatarKey,
  );
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const place = values.location || {
    city: "",
    region: "",
    countryCode: "IN",
    label: "",
    saveExact: false,
  };
  const pickId = useRef(0);
  async function pick(point: { latitude: number; longitude: number }) {
    const id = ++pickId.current;
    setValues((current) => ({
      ...current,
      location: { ...(current.location || place), ...point },
    }));
    try {
      const response = await fetch("/api/location", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "reverse", ...point }),
      });
      const result = await response.json();
      if (id !== pickId.current) return;
      if (response.ok && result.places?.[0])
        setValues((current) => ({
          ...current,
          location: {
            ...result.places[0],
            ...point,
            saveExact: current.location?.saveExact || false,
          },
        }));
      else
        setMessage(
          "Pin selected. Enter your city below to save your location.",
        );
    } catch {
      if (id === pickId.current)
        setMessage(
          "Pin selected. Enter your city below to save your location.",
        );
    }
  }
  function location(patch: Partial<NonNullable<ProfileValues["location"]>>) {
    ++pickId.current;
    setValues({ ...values, location: { ...place, ...patch } });
  }
  async function photo(file?: File) {
    setBusy(true);
    setMessage("");
    try {
      const body = new FormData();
      if (file) body.set("photo", file);
      const response = await fetch("/api/profile/avatar", {
        method: file ? "POST" : "DELETE",
        ...(file ? { body } : {}),
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.error || "Could not update photo.");
      setAvatar(result.url || null);
      router.refresh();
      setMessage("Profile photo updated.");
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Could not update photo.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function save(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...values,
          location: place.city.trim() ? place : null,
        }),
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.error || "Could not save profile.");
      router.refresh();
      setMessage("Your profile is saved.");
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Could not save profile.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="r-settings">
      <div className="r-compact-heading"><div><p className="m-eyebrow">YOUR ACCOUNT</p><h1>Profile</h1><p>Your details, photo and city in one place.</p></div></div>
      <section className="r-settings-card r-photo-row">
        <div className="r-avatar-large">
          {avatar ? (
            // Profile photos are resized on upload; Google profile photos remain remote.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={avatar}
              alt="Your profile photo"
              referrerPolicy="no-referrer"
            />
          ) : (
            initial.name.slice(0, 1).toUpperCase()
          )}
        </div>
        <div>
          <h2>Profile photo</h2>
          <p>JPEG, PNG or WebP · up to 2 MB</p>
          <label className="m-button m-button-small">
            Change photo
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              disabled={busy}
              onChange={(event) => {
                void photo(event.target.files?.[0]);
                event.target.value = "";
              }}
              className="sr-only"
            />
          </label>
          {avatar && (
            <button
              type="button"
              disabled={busy}
              onClick={() => photo()}
              className="m-text-link"
            >
              Remove photo
            </button>
          )}
        </div>
      </section>
      <form onSubmit={save}>
        <section className="r-settings-card">
          <h2>Personal details</h2>
          <div className="r-settings-fields">
            <label>
              Full name
              <input
                required
                minLength={2}
                maxLength={100}
                autoComplete="name"
                value={values.name}
                onChange={(e) => setValues({ ...values, name: e.target.value })}
              />
            </label>
            <label>
              Email address
              <input value={email} readOnly type="email" />
            </label>
            <label>
              Phone number
              <input
                required
                type="tel"
                autoComplete="tel"
                value={values.phone}
                onChange={(e) =>
                  setValues({ ...values, phone: e.target.value })
                }
              />
            </label>
            <label>
              Gender · optional
              <select
                value={values.gender || ""}
                onChange={(e) =>
                  setValues({ ...values, gender: e.target.value || null })
                }
              >
                <option value="">Not specified</option>
                <option value="FEMALE">Female</option>
                <option value="MALE">Male</option>
                <option value="NON_BINARY">Non-binary</option>
                <option value="OTHER">Another identity</option>
                <option value="PREFER_NOT_TO_SAY">Prefer not to say</option>
              </select>
            </label>
          </div>
        </section>
        <section className="r-settings-card">
          <h2>Location</h2>
          <LocationSearch
            value={place.city}
            onChange={city => location({ city, region: "", label: "", latitude: undefined, longitude: undefined, saveExact: false })}
            onSelect={selected => location({ ...selected, saveExact: false })}
            point={
              place.latitude !== undefined && place.longitude !== undefined
                ? { latitude: place.latitude, longitude: place.longitude }
                : null
            }
            onPick={pick}
          />
          <div className="r-settings-fields">
            <label>
              State / region
              <input
                value={place.region}
                maxLength={120}
                autoComplete="address-level1"
                onChange={(e) => location({ region: e.target.value })}
              />
            </label>
            <label>
              Country
              <select
                value={place.countryCode}
                onChange={(e) => location({ countryCode: e.target.value })}
              >
                {countries.map((country) => (
                  <option key={country.code} value={country.code}>
                    {country.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {place.latitude !== undefined && <label className="m-auth-consent">
            <input
              type="checkbox"
              checked={place.saveExact}
              onChange={(e) => location({ saveExact: e.target.checked })}
            />
            <span>
              Save this precise pin privately. Otherwise, only my city is saved.
            </span>
          </label>}
        </section>
        <div className="r-settings-save">
          <button className="m-button" disabled={busy}>
            {busy ? "Saving…" : "Save changes ↗"}
          </button>
          <p role="status">{message}</p>
        </div>
      </form>
    </div>
  );
}
