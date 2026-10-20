"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { UserPlus, UserCheck, Loader2 } from "lucide-react";

type FollowOrganizerButtonProps = {
  orgId: string;
  initialFollowersCount: number;
  initialIsFollowing: boolean;
  className?: string;
  compact?: boolean;
};

export function FollowOrganizerButton({
  orgId,
  initialFollowersCount,
  initialIsFollowing,
  className = "",
  compact = false,
}: FollowOrganizerButtonProps) {
  const router = useRouter();
  const [isFollowing, setIsFollowing] = useState(initialIsFollowing);
  const [count, setCount] = useState(initialFollowersCount);
  const [loading, setLoading] = useState(false);

  const toggleFollow = async () => {
    if (loading) return;
    const nextFollowing = !isFollowing;
    const nextCount = count + (nextFollowing ? 1 : -1);

    // Optimistic update
    setIsFollowing(nextFollowing);
    setCount(Math.max(0, nextCount));
    setLoading(true);

    try {
      const res = await fetch(`/api/orgs/${orgId}/follow`, {
        method: "POST",
      });

      if (res.status === 401) {
        // Not logged in -> redirect to login with current location
        router.push(`/login?next=${encodeURIComponent(window.location.pathname)}`);
        return;
      }

      if (!res.ok) {
        throw new Error("Failed to update follow status");
      }

      const data = await res.json();
      setIsFollowing(Boolean(data.following));
      setCount(Number(data.followerCount));
    } catch {
      // Revert on failure
      setIsFollowing(!nextFollowing);
      setCount(count);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={toggleFollow}
      disabled={loading}
      aria-pressed={isFollowing}
      aria-label={isFollowing ? "Unfollow organizer" : "Follow organizer"}
      className={`inline-flex items-center gap-1.5 rounded-full font-semibold transition-all cursor-pointer select-none ${
        compact
          ? "px-3 py-1.5 text-xs"
          : "px-4 py-2 text-sm"
      } ${
        isFollowing
          ? "border border-[var(--line)] bg-[var(--surface-raised)] text-[var(--ink)] hover:border-[var(--danger)] hover:text-[var(--danger)] hover:bg-[var(--danger-bg)]"
          : "border-2 border-[var(--ink)] bg-[var(--ink)] text-[var(--paper)] shadow-[2px_2px_0_var(--ink)] hover:opacity-90 active:translate-x-[1px] active:translate-y-[1px] active:shadow-none"
      } ${className}`}
    >
      {loading ? (
        <Loader2 size={compact ? 13 : 15} className="animate-spin" aria-hidden="true" />
      ) : isFollowing ? (
        <UserCheck size={compact ? 13 : 15} aria-hidden="true" />
      ) : (
        <UserPlus size={compact ? 13 : 15} aria-hidden="true" />
      )}
      <span>{isFollowing ? "Following" : "Follow"}</span>
      {count > 0 && (
        <span
          className={`ml-0.5 rounded-full px-1.5 py-0.2 text-[0.6875rem] font-mono ${
            isFollowing
              ? "bg-[var(--surface)] text-[var(--muted)]"
              : "bg-[var(--paper)] text-[var(--ink)]"
          }`}
        >
          {count}
        </span>
      )}
    </button>
  );
}
