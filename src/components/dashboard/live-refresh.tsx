"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
export function LiveRefresh() {
  const router = useRouter();
  const [enabled, setEnabled] = useState(true);
  useEffect(() => {
    if (!enabled) return;
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, 10000);
    return () => clearInterval(timer);
  }, [enabled, router]);
  return (
    <div className="ops-live">
      <label>
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
        />{" "}
        Live updates · every 10s
      </label>
      <button className="r-quiet-button" onClick={() => router.refresh()}>
        Refresh
      </button>
    </div>
  );
}
