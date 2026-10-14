"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function OnboardingForm() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const data = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/orgs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: data.get("name"),
          slug: data.get("slug"),
        }),
      });
      const result = await response.json();
      if (response.ok) {
        router.push("/dashboard");
        router.refresh();
      } else {
        setError(result.error || "Could not create workspace.");
        setBusy(false);
      }
    } catch {
      setError("Could not create workspace. Please try again.");
      setBusy(false);
    }
  }
  return (
    <main className="m-legal m-container">
      <div className="m-legal-content r-workspace-form">
        <a href="/account" className="m-text-link">
          ← Attendee view
        </a>
        <p className="m-eyebrow">YOUR FIRST EVENT STARTS HERE</p>
        <h1 className="m-heading">Create your workspace</h1>
        <p className="mt-2 text-zinc-600 dark:text-zinc-400">
          Your team and events live in one workspace.
        </p>
        <form onSubmit={submit} className="r-profile-fields">
          <div>
            <label htmlFor="name" className="block text-sm font-medium">
              Workspace name
            </label>
            <input
              id="name"
              name="name"
              required
              minLength={2}
              maxLength={100}
              className="mt-2 w-full rounded-xl border border-zinc-300 bg-transparent px-4 py-3 dark:border-zinc-700"
            />
          </div>
          <div>
            <label htmlFor="slug" className="block text-sm font-medium">
              Workspace URL name
            </label>
            <input
              id="slug"
              name="slug"
              required
              pattern="[a-z0-9]+(-[a-z0-9]+)*"
              minLength={3}
              maxLength={80}
              placeholder="acme-club"
              className="mt-2 w-full rounded-xl border border-zinc-300 bg-transparent px-4 py-3 dark:border-zinc-700"
            />
          </div>
          <button disabled={busy} className="m-button">
            Create workspace
          </button>
        </form>
        {error && (
          <p role="alert" className="mt-4 text-red-600">
            {error}
          </p>
        )}
      </div>
    </main>
  );
}
