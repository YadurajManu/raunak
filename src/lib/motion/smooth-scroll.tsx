"use client";
import { useEffect, useState } from "react";
import { ReactLenis } from "lenis/react";
import { useReducedMotion } from "./reduced";
export function SmoothScroll() {
  const reduced = useReducedMotion();
  const [desktop, setDesktop] = useState(false);
  useEffect(() => {
    const query = matchMedia("(min-width: 768px)");
    const update = () => setDesktop(query.matches);
    query.addEventListener("change", update);
    requestAnimationFrame(update);
    return () => query.removeEventListener("change", update);
  }, []);
  return desktop && !reduced ? (
    <ReactLenis
      root
      options={{ smoothWheel: true, lerp: 0.12, anchors: true }}
    />
  ) : null;
}
