"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { BadgeCheck, Star } from "lucide-react";

type Review = {
  id: string;
  name: string;
  rating: number;
  body: string | null;
  firstTimerFriendly: boolean | null;
  easyToReach: boolean | null;
  createdAt: string;
  isMine: boolean;
};

type OwnReview = {
  rating: number;
  body: string;
  firstTimerFriendly: boolean | null;
  easyToReach: boolean | null;
} | null;

export function EventReviews({
  eventId,
  eventUrl,
  signedIn,
  reviews,
  averageRating,
  reviewCount,
  canReview,
  reviewOpen,
  ownReview,
}: {
  eventId: string;
  eventUrl: string;
  signedIn: boolean;
  reviews: Review[];
  averageRating: number | null;
  reviewCount: number;
  canReview: boolean;
  reviewOpen: boolean;
  ownReview: OwnReview;
}) {
  const router = useRouter();
  const [rating, setRating] = useState<number | null>(ownReview?.rating ?? null);
  const [body, setBody] = useState(ownReview?.body ?? "");
  const [firstTimerFriendly, setFirstTimerFriendly] = useState<boolean | null>(
    ownReview?.firstTimerFriendly ?? null,
  );
  const [easyToReach, setEasyToReach] = useState<boolean | null>(
    ownReview?.easyToReach ?? null,
  );
  const [hasSaved, setHasSaved] = useState(Boolean(ownReview));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!rating) return;
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const response = await fetch(`/api/events/${eventId}/reviews`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating, body, firstTimerFriendly, easyToReach }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not save your review.");
      setSuccess(hasSaved ? "Your review has been updated." : "Thanks for sharing your experience.");
      setHasSaved(true);
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save your review.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="mt-12 scroll-mt-24" id="reviews" aria-labelledby="event-reviews-title">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-[var(--line)] pb-4">
        <div>
          <h2 className="text-2xl font-semibold" id="event-reviews-title">
            Attendee reviews
          </h2>
        </div>
        {reviewCount > 0 && averageRating !== null && (
          <div className="flex items-center gap-2" aria-label={`${averageRating.toFixed(1)} out of 5 from ${reviewCount} reviews`}>
            <Star size={18} fill="currentColor" className="text-[var(--accent)]" aria-hidden="true" />
            <strong>{averageRating.toFixed(1)}</strong>
            <span className="text-sm text-[var(--muted)]">· {reviewCount} {reviewCount === 1 ? "review" : "reviews"}</span>
          </div>
        )}
      </div>

      {reviews.length > 0 ? (
        <ul className="divide-y divide-[var(--line)]">
          {reviews.map((review) => (
            <li className="py-5" key={review.id}>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <strong>{review.name}</strong>
                <span className="inline-flex items-center gap-1 text-xs text-[var(--muted)]">
                  <BadgeCheck size={14} aria-hidden="true" /> Verified attendee
                </span>
                {review.isMine && <span className="text-xs text-[var(--muted)]">Your review</span>}
                <time className="ml-auto text-xs text-[var(--muted)]" dateTime={review.createdAt}>
                  {new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(new Date(review.createdAt))}
                </time>
              </div>
              <p className="mt-2 text-sm tracking-[0.12em] text-[var(--accent)]" aria-label={`${review.rating} out of 5 stars`}>
                {"★".repeat(review.rating)}{"☆".repeat(5 - review.rating)}
              </p>
              {review.body && <p className="mt-2 whitespace-pre-wrap leading-relaxed">{review.body}</p>}
              {(review.firstTimerFriendly === true || review.easyToReach === true) && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {review.firstTimerFriendly === true && <span className="rounded-full border border-[var(--line)] px-3 py-1 text-xs">Good for first-timers</span>}
                  {review.easyToReach === true && <span className="rounded-full border border-[var(--line)] px-3 py-1 text-xs">Easy to reach</span>}
                </div>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="py-5 text-sm text-[var(--muted)]">
          {reviewOpen
            ? "No attendee reviews yet. Be the first to share what it was like."
            : "Reviews open after the event for people with a valid booking."}
        </p>
      )}

      {canReview ? (
        <form className="mt-3 rounded-2xl border border-[var(--line)] p-5 sm:p-6" onSubmit={submit}>
          <h3 className="font-semibold">{hasSaved ? "Update your review" : "How was it?"}</h3>
          <p className="mt-1 text-sm text-[var(--muted)]">Your booking is verified. Share a rating and any useful tips for future guests.</p>
          <fieldset className="mt-5">
            <legend className="text-sm font-medium">Your rating</legend>
            <div className="mt-2 flex gap-1" role="radiogroup" aria-label="Your rating">
              {[1, 2, 3, 4, 5].map((value) => (
                <label className="cursor-pointer" key={value}>
                  <input
                    className="peer sr-only"
                    type="radio"
                    name={`event-rating-${eventId}`}
                    value={value}
                    checked={rating === value}
                    onChange={() => setRating(value)}
                  />
                  <span className={`inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg text-2xl peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[var(--focus-ring)] ${rating !== null && value <= rating ? "text-[var(--accent)]" : "text-[var(--muted)]"}`}>
                    <span aria-hidden="true">★</span><span className="sr-only">{value} {value === 1 ? "star" : "stars"}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
          <label className="mt-4 block text-sm font-medium" htmlFor={`review-body-${eventId}`}>
            A note for future guests <span className="font-normal text-[var(--muted)]">· optional</span>
          </label>
          <textarea
            className="mt-2 min-h-28 w-full rounded-xl border border-[var(--line)] bg-transparent p-3 text-sm placeholder:text-[var(--muted)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]"
            id={`review-body-${eventId}`}
            maxLength={1200}
            value={body}
            onChange={(event) => setBody(event.target.value)}
            placeholder="What should someone know before they go?"
          />
          <p className="mt-1 text-right text-xs text-[var(--muted)]">{body.length}/1200</p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-medium">
              Good for first-timers?
              <select className="mt-2 block min-h-11 w-full rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 font-normal" value={firstTimerFriendly === null ? "" : String(firstTimerFriendly)} onChange={(event) => setFirstTimerFriendly(event.target.value === "" ? null : event.target.value === "true")}>
                <option value="">Skip</option><option value="true">Yes</option><option value="false">No</option>
              </select>
            </label>
            <label className="text-sm font-medium">
              Easy to reach?
              <select className="mt-2 block min-h-11 w-full rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 font-normal" value={easyToReach === null ? "" : String(easyToReach)} onChange={(event) => setEasyToReach(event.target.value === "" ? null : event.target.value === "true")}>
                <option value="">Skip</option><option value="true">Yes</option><option value="false">No</option>
              </select>
            </label>
          </div>
          {error && <p className="mt-4 text-sm text-[var(--danger)]" role="alert">{error}</p>}
          {success && <p className="mt-4 text-sm text-[var(--muted)]" role="status">{success}</p>}
          <button className="mt-5 min-h-11 rounded-xl bg-[var(--accent)] px-5 font-semibold text-[var(--on-accent)] disabled:cursor-not-allowed disabled:opacity-60" type="submit" disabled={saving || !rating}>
            {saving ? "Saving…" : hasSaved ? "Update review" : "Share review"}
          </button>
        </form>
      ) : reviewOpen && signedIn ? (
        <p className="mt-2 rounded-xl bg-[var(--surface)] p-4 text-sm text-[var(--muted)]">
          Reviews are reserved for people with a paid booking for this event.
        </p>
      ) : reviewOpen ? (
        <p className="mt-2 rounded-xl bg-[var(--surface)] p-4 text-sm">
          Sign in with the account used for your booking to leave a review. {" "}
          <Link className="font-semibold text-[var(--accent)] underline underline-offset-4" href={`/login?next=${encodeURIComponent(eventUrl + "#reviews")}`}>
            Sign in
          </Link>
        </p>
      ) : null}
    </section>
  );
}
