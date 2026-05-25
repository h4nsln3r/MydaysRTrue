"use client";

import { useEffect, useRef, useState } from "react";
import { formatMl } from "@/lib/water";
import styles from "./WaterBottle.module.scss";

interface WaterBottleProps {
  /** 0..1 — fraction of the day's goal completed */
  progress: number;
  /** Total ml drunk so far */
  totalMl: number;
  /** Daily goal in ml */
  goalMl: number;
  /** Total animation duration in ms (default 1100ms) */
  animationMs?: number;
}

// easeOutCubic — fast start, gentle landing. Feels natural for "filling".
const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

/**
 * Animates from the previously-displayed value to the new target whenever
 * `target` changes. On first mount it animates from 0, so the bottle
 * "fills up" when you arrive on the page.
 */
function useAnimatedNumber(target: number, durationMs: number): number {
  const [value, setValue] = useState(0);
  const fromRef = useRef(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    // Respect users who prefer reduced motion.
    const prefersReduced =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    if (prefersReduced) {
      fromRef.current = target;
      setValue(target);
      return;
    }

    const from = fromRef.current;
    const to = target;
    const start = performance.now();

    const tick = (now: number) => {
      const elapsed = now - start;
      const t = Math.min(1, elapsed / durationMs);
      const eased = easeOutCubic(t);
      const next = from + (to - from) * eased;
      setValue(next);

      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        fromRef.current = to;
      }
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, [target, durationMs]);

  return value;
}

export function WaterBottle({
  progress,
  totalMl,
  goalMl,
  animationMs = 1100,
}: WaterBottleProps) {
  const clamped = Math.max(0, Math.min(1, progress));

  const animatedProgress = useAnimatedNumber(clamped, animationMs);
  const animatedTotal = useAnimatedNumber(totalMl, animationMs);

  const percent = Math.round(animatedProgress * 100);
  const remaining = Math.max(0, goalMl - Math.round(animatedTotal));

  // The internal liquid surface y goes from y=82 (empty) to y=18 (full).
  const liquidTop = 82 - animatedProgress * 64;

  const isFull = clamped >= 1;

  return (
    <div
      className={[styles.wrap, isFull ? styles.full : ""].join(" ")}
      aria-label={`Water progress: ${Math.round(clamped * 100)}%`}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(clamped * 100)}
    >
      <svg viewBox="0 0 120 160" className={styles.svg} role="img" aria-hidden>
        <defs>
          <linearGradient id="waterFill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#7cc6ff" />
            <stop offset="100%" stopColor="#1f6fb0" />
          </linearGradient>
          <linearGradient id="waterFillFull" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#a8e063" />
            <stop offset="100%" stopColor="#1f9d5d" />
          </linearGradient>
          <clipPath id="bottleClip">
            <path d="M44 16 h32 v10 c0 2 1 4 3 6 l4 6 c5 6 7 14 7 22 v76 c0 6 -5 12 -12 12 H42 c-7 0 -12 -6 -12 -12 V60 c0 -8 2 -16 7 -22 l4 -6 c2 -2 3 -4 3 -6 V16 z" />
          </clipPath>
        </defs>

        {/* Bottle body (back) */}
        <path
          d="M44 16 h32 v10 c0 2 1 4 3 6 l4 6 c5 6 7 14 7 22 v76 c0 6 -5 12 -12 12 H42 c-7 0 -12 -6 -12 -12 V60 c0 -8 2 -16 7 -22 l4 -6 c2 -2 3 -4 3 -6 V16 z"
          fill="#141414"
          stroke="#2a2a2a"
          strokeWidth="2"
        />

        {/* Liquid (clipped to bottle shape) */}
        <g clipPath="url(#bottleClip)">
          <rect
            x="0"
            y={liquidTop}
            width="120"
            height={160 - liquidTop}
            fill={isFull ? "url(#waterFillFull)" : "url(#waterFill)"}
          />
          {/* Wavy surface — two layered waves moving in opposite directions */}
          <path
            className={styles.waveBack}
            d={`M-20 ${liquidTop} Q10 ${liquidTop - 4}, 40 ${liquidTop} T100 ${liquidTop} T160 ${liquidTop} V160 H-20 Z`}
            fill="rgba(255,255,255,0.18)"
          />
          <path
            className={styles.waveFront}
            d={`M-20 ${liquidTop + 1} Q10 ${liquidTop - 5}, 40 ${liquidTop + 1} T100 ${liquidTop + 1} T160 ${liquidTop + 1} V160 H-20 Z`}
            fill="rgba(255,255,255,0.32)"
          />
          {/* Bubbles */}
          <circle className={styles.bubble1} cx="50" cy="120" r="3" fill="rgba(255,255,255,0.7)" />
          <circle className={styles.bubble2} cx="70" cy="140" r="2" fill="rgba(255,255,255,0.6)" />
          <circle className={styles.bubble3} cx="60" cy="100" r="2.5" fill="rgba(255,255,255,0.55)" />
        </g>

        {/* Cap */}
        <rect x="46" y="6" width="28" height="14" rx="3" fill="#ff7a1a" />
        <rect x="46" y="6" width="28" height="4" rx="2" fill="#ff9a3c" />

        {/* Highlight */}
        <path
          d="M40 50 q-5 8 -5 18 v60"
          stroke="rgba(255,255,255,0.18)"
          strokeWidth="3"
          fill="none"
          strokeLinecap="round"
        />

        {/* Goal marker */}
        <line x1="32" y1="18" x2="38" y2="18" stroke="#ff7a1a" strokeWidth="2" strokeLinecap="round" />
        <text x="22" y="22" fontSize="8" fill="#ff7a1a" fontFamily="monospace" textAnchor="end">
          GOAL
        </text>
      </svg>

      <div className={styles.readout}>
        <div className={[styles.percent, isFull ? styles.percentFull : ""].join(" ")}>
          <span className={styles.percentNum}>{percent}</span>
          <span className={styles.unit}>%</span>
        </div>
        <div className={styles.stats}>
          <div>
            <span className={styles.statLabel}>Drunk</span>
            <span className={styles.statValue}>{formatMl(Math.round(animatedTotal))}</span>
          </div>
          <div>
            <span className={styles.statLabel}>Left</span>
            <span className={styles.statValue}>{formatMl(remaining)}</span>
          </div>
          <div>
            <span className={styles.statLabel}>Goal</span>
            <span className={styles.statValue}>{formatMl(goalMl)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
