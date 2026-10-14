"use client";
import { useRef } from "react";
import { motion, useInView, useMotionValue, useSpring } from "motion/react";
import { useReducedMotion } from "./reduced";

export function Reveal({ children, className = "", delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const visible = useInView(ref, { once: true, margin: "0px 0px -60px 0px" });
  const reduced = useReducedMotion();
  return <motion.div ref={ref} className={className} initial={false} animate={visible || reduced ? { opacity: 1, y: 0 } : { opacity: 0, y: 28 }} transition={{ duration: reduced ? 0 : 0.7, delay, ease: [0.22, 1, 0.36, 1] }}>{children}</motion.div>;
}
export function SplitWords({ children, className = "" }: { children: string; className?: string }) {
  const reduced = useReducedMotion();
  return <span className={className} aria-label={children}>{children.split(" ").map((word, index) => <span className="m-word-mask" aria-hidden="true" key={`${word}-${index}`}><motion.span initial={reduced ? false : { y: "115%" }} animate={{ y: 0 }} transition={{ duration: 0.75, delay: 0.13 + index * 0.06, ease: [0.22, 1, 0.36, 1] }}>{word}&nbsp;</motion.span></span>)}</span>;
}
export function Magnetic({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const reduced = useReducedMotion();
  const x = useSpring(useMotionValue(0), { stiffness: 220, damping: 18 });
  const y = useSpring(useMotionValue(0), { stiffness: 220, damping: 18 });
  return <motion.span className={className} style={{ x, y }} onPointerMove={event => { if (reduced || event.pointerType !== "mouse") return; const rect = event.currentTarget.getBoundingClientRect(); x.set((event.clientX - rect.left - rect.width / 2) * 0.18); y.set((event.clientY - rect.top - rect.height / 2) * 0.18); }} onPointerLeave={() => { x.set(0); y.set(0); }}>{children}</motion.span>;
}
export function Tilt({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const reduced = useReducedMotion();
  const rotateX = useSpring(useMotionValue(0), { stiffness: 160, damping: 20 });
  const rotateY = useSpring(useMotionValue(0), { stiffness: 160, damping: 20 });
  const glareX = useMotionValue("50%"); const glareY = useMotionValue("50%");
  return <motion.div className={className} style={{ rotateX, rotateY, transformPerspective: 900 }} onPointerMove={event => { if (reduced || event.pointerType !== "mouse") return; const rect = event.currentTarget.getBoundingClientRect(); const x = (event.clientX - rect.left) / rect.width; const y = (event.clientY - rect.top) / rect.height; rotateY.set((x - 0.5) * 11); rotateX.set((0.5 - y) * 11); glareX.set(`${x * 100}%`); glareY.set(`${y * 100}%`); }} onPointerLeave={() => { rotateX.set(0); rotateY.set(0); }}><div className="m-tilt-content">{children}</div>{!reduced && <motion.div className="m-tilt-glare" style={{ background: `radial-gradient(circle at var(--glare-x, 50%) var(--glare-y, 50%), rgba(255,255,255,.25), transparent 55%)`, left: glareX, top: glareY }} aria-hidden="true" />}</motion.div>;
}
