"use client";
import { useReducedMotion as useMotionReduced } from "motion/react";
export function useReducedMotion() { return Boolean(useMotionReduced()); }
