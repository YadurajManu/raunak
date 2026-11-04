"use client";

import { useEffect, useState } from "react";
import { ArrowDownToLine, X } from "lucide-react";

const dismissalKey = "raunak-android-announcement-until";
const thirtyDays = 30 * 24 * 60 * 60 * 1000;

export function AppDownload() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (Number(localStorage.getItem(dismissalKey)) > Date.now()) return;
    } catch {
      // The announcement still works when storage is unavailable.
    }

    const reveal = () => setVisible(true);
    const timer = window.setTimeout(reveal, 8000);
    const hero = document.querySelector(".m-hero");
    const observer = hero && new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting && window.scrollY > 0) reveal();
    });
    if (hero && observer) observer.observe(hero);
    return () => {
      window.clearTimeout(timer);
      observer?.disconnect();
    };
  }, []);

  if (!visible) return null;

  function dismiss() {
    setVisible(false);
    try {
      localStorage.setItem(dismissalKey, String(Date.now() + thirtyDays));
    } catch {
      // Dismissal still applies for this page view.
    }
  }

  return (
    <aside className="m-app-pop" aria-label="Raunak Android app announcement">
      <span className="m-app-pop-drop" aria-hidden="true"><ArrowDownToLine size={22} strokeWidth={2.3} /></span>
      <div className="m-app-pop-copy">
        <strong>Raunak for Android is here.</strong>
        <span>Find events and keep your tickets handy.</span>
        <a href="/downloads/raunak-v1.0.0.apk" download="raunak-v1.0.0.apk" onClick={dismiss}>Download the app <span aria-hidden="true">↗</span></a>
      </div>
      <button className="m-app-pop-close" type="button" onClick={dismiss} aria-label="Dismiss Android app announcement"><X size={18} aria-hidden="true" /></button>
    </aside>
  );
}
