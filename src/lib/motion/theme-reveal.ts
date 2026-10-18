"use client";

import { flushSync } from "react-dom";

let revealing = false;

export async function revealTheme(
  button: HTMLButtonElement,
  theme: "light" | "dark",
) {
  if (revealing) return;
  const root = document.documentElement;
  let applied = false;
  const apply = () => {
    if (applied) return;
    applied = true;
    // The incoming snapshot must include React's updated icons and labels too.
    flushSync(() => {
      root.dataset.marketingTheme = theme;
      try {
        localStorage.setItem("raunak-theme", theme);
      } catch {}
      window.dispatchEvent(new Event("raunak-theme"));
    });
    // Finish only theme-color transitions; keep motion and hover transforms intact.
    for (const animation of document.getAnimations()) {
      if (
        typeof CSSTransition !== "undefined" &&
        animation instanceof CSSTransition &&
        /color|background|border|fill|stroke/.test(animation.transitionProperty)
      )
        animation.finish();
    }
  };
  if (
    !document.startViewTransition ||
    matchMedia("(prefers-reduced-motion: reduce)").matches
  ) {
    apply();
    return;
  }
  const rect = button.getBoundingClientRect();
  const x = rect.left + rect.width / 2,
    y = rect.top + rect.height / 2;
  const radius = Math.max(
    Math.hypot(x, y),
    Math.hypot(innerWidth - x, y),
    Math.hypot(x, innerHeight - y),
    Math.hypot(innerWidth - x, innerHeight - y),
  );
  revealing = true;
  root.dataset.themeRevealing = "true";
  let transition: ViewTransition | undefined;
  let animation: Animation | undefined;
  try {
    transition = document.startViewTransition(apply);
    const finished = transition.finished.catch(() => {});
    await transition.ready;
    animation = root.animate(
      {
        clipPath: [
          `circle(0px at ${x}px ${y}px)`,
          `circle(${Math.ceil(radius)}px at ${x}px ${y}px)`,
        ],
      },
      {
        duration: 650,
        easing: "cubic-bezier(0.22, 1, 0.36, 1)",
        pseudoElement: "::view-transition-new(root)",
        fill: "both",
      },
    );
    await animation.finished;
    await finished;
  } catch {
    transition?.skipTransition();
    await transition?.updateCallbackDone.catch(() => {});
    apply();
  } finally {
    animation?.cancel();
    delete root.dataset.themeRevealing;
    revealing = false;
  }
}
