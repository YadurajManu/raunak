"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
export function BookingRefresh({ pending }: { pending: boolean }) {
  const router = useRouter();
  const [checks, setChecks] = useState(0);
  useEffect(() => {
    if (!pending || checks >= 12) return;
    const timer = setTimeout(() => {
      setChecks((n) => n + 1);
      router.refresh();
    }, 5000);
    return () => clearTimeout(timer);
  }, [pending, checks, router]);
  return (
    <div className="booking-refresh">
      <p role="status">
        {pending && checks < 12
          ? "Checking payment status automatically…"
          : pending
            ? "Still waiting for confirmation. Check again shortly; you do not need to pay twice."
            : "Your booking details are up to date."}
      </p>
      <button
        className="r-quiet-button"
        onClick={() => {
          setChecks(0);
          router.refresh();
        }}
      >
        Check status
      </button>
    </div>
  );
}
