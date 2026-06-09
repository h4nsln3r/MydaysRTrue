"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveDailyActivityAction } from "@/app/(app)/actions";
import { Card } from "@/components/Card/Card";
import { Input } from "@/components/Input/Input";
import { formatMl } from "@/lib/water";
import styles from "./DailyActivityCard.module.scss";

interface Props {
  date: string;
  steps: number | null;
  stepsGoal: number;
  activityHours: number | null;
  activityHoursGoal: number;
  showSteps: boolean;
  showActivity: boolean;
  /** Single-metric mode: own title, no shared save button. */
  compact?: boolean;
  /** Optional water summary when water tracking is on. */
  waterMl?: number;
  waterGoalMl?: number;
  showWater?: boolean;
}

function parseSteps(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed === "") return null;
  const n = Math.round(Number(trimmed));
  return Number.isFinite(n) ? n : NaN;
}

function parseHours(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed === "") return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? Math.round(n * 10) / 10 : NaN;
}

export function DailyActivityCard({
  date,
  steps,
  stepsGoal,
  activityHours,
  activityHoursGoal,
  showSteps,
  showActivity,
  compact = false,
  waterMl,
  waterGoalMl,
  showWater = false,
}: Props) {
  const router = useRouter();
  const [pendingField, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [stepsVal, setStepsVal] = useState(
    steps != null ? String(steps) : "",
  );
  const [hoursVal, setHoursVal] = useState(
    activityHours != null ? String(activityHours) : "",
  );
  const stepsRef = useRef(steps);
  const hoursRef = useRef(activityHours);

  useEffect(() => {
    stepsRef.current = steps;
    setStepsVal(steps != null ? String(steps) : "");
  }, [steps]);

  useEffect(() => {
    hoursRef.current = activityHours;
    setHoursVal(activityHours != null ? String(activityHours) : "");
  }, [activityHours]);

  const stepsPct =
    stepsGoal > 0 && steps != null
      ? Math.min(100, Math.round((steps / stepsGoal) * 100))
      : 0;
  const hoursPct =
    activityHoursGoal > 0 && activityHours != null
      ? Math.min(100, Math.round((activityHours / activityHoursGoal) * 100))
      : 0;

  const saveSteps = () => {
    const next = parseSteps(stepsVal);
    if (Number.isNaN(next)) {
      setError("Ogiltigt antal steg.");
      setStepsVal(stepsRef.current != null ? String(stepsRef.current) : "");
      return;
    }
    if (next === stepsRef.current) return;

    setError(null);
    startTransition(async () => {
      const res = await saveDailyActivityAction({
        localDate: date,
        steps: next,
      });
      if (!res.ok) {
        setError(res.error ?? "Kunde inte spara steg.");
        setStepsVal(stepsRef.current != null ? String(stepsRef.current) : "");
        return;
      }
      router.refresh();
    });
  };

  const saveHours = () => {
    const next = parseHours(hoursVal);
    if (Number.isNaN(next)) {
      setError("Ogiltigt antal timmar.");
      setHoursVal(
        hoursRef.current != null ? String(hoursRef.current) : "",
      );
      return;
    }
    if (next === hoursRef.current) return;

    setError(null);
    startTransition(async () => {
      const res = await saveDailyActivityAction({
        localDate: date,
        activityHours: next,
      });
      if (!res.ok) {
        setError(res.error ?? "Kunde inte spara aktivitet.");
        setHoursVal(
          hoursRef.current != null ? String(hoursRef.current) : "",
        );
        return;
      }
      router.refresh();
    });
  };

  if (!showSteps && !showActivity && !showWater) return null;

  const title = compact
    ? showSteps
      ? "Steg"
      : showActivity
        ? "Aktivitet"
        : "Dagens aktivitet"
    : "Dagens aktivitet";

  const metricCount =
    (showSteps ? 1 : 0) + (showActivity ? 1 : 0) + (showWater ? 1 : 0);

  return (
    <Card className={styles.card}>
      {metricCount > 1 || !compact ? (
        <header className={styles.header}>
          <h2 className={styles.title}>{title}</h2>
        </header>
      ) : null}

      {showWater && waterGoalMl != null ? (
        <div className={styles.metric}>
          <span className={styles.metricLabel}>💧 Vatten</span>
          <span className={styles.metricValue}>
            {formatMl(waterMl ?? 0)} / {formatMl(waterGoalMl)}
          </span>
          <div className={styles.bar} aria-hidden>
            <div
              className={styles.barFill}
              style={{
                width: `${waterGoalMl > 0 ? Math.min(100, Math.round(((waterMl ?? 0) / waterGoalMl) * 100)) : 0}%`,
              }}
            />
          </div>
        </div>
      ) : null}

      {showSteps ? (
        <div className={styles.metric}>
          {compact ? (
            <h2 className={styles.metricTitle}>👟 Steg</h2>
          ) : (
            <span className={styles.metricLabel}>👟 Steg</span>
          )}
          {steps != null ? (
            <>
              <span className={styles.metricValue}>
                {steps.toLocaleString()} / {stepsGoal.toLocaleString()}
              </span>
              <div className={styles.bar} aria-hidden>
                <div
                  className={[styles.barFill, styles.barFillSteps]
                    .filter(Boolean)
                    .join(" ")}
                  style={{ width: `${stepsPct}%` }}
                />
              </div>
            </>
          ) : (
            <span className={styles.metricHint}>
              Mål: {stepsGoal.toLocaleString()} steg
            </span>
          )}
          <Input
            label="Antal steg idag"
            type="number"
            min={0}
            max={200000}
            step={100}
            value={stepsVal}
            onChange={(e) => setStepsVal(e.target.value)}
            onBlur={saveSteps}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
            }}
            placeholder={`T.ex. ${stepsGoal.toLocaleString()}`}
            inputMode="numeric"
            disabled={pendingField}
          />
        </div>
      ) : null}

      {showActivity ? (
        <div className={styles.metric}>
          {compact ? (
            <h2 className={styles.metricTitle}>⏱ Aktivitet</h2>
          ) : (
            <span className={styles.metricLabel}>⏱ Aktivitet</span>
          )}
          {activityHours != null ? (
            <>
              <span className={styles.metricValue}>
                {activityHours} / {activityHoursGoal} tim
              </span>
              <div className={styles.bar} aria-hidden>
                <div
                  className={[styles.barFill, styles.barFillActivity]
                    .filter(Boolean)
                    .join(" ")}
                  style={{ width: `${hoursPct}%` }}
                />
              </div>
            </>
          ) : (
            <span className={styles.metricHint}>
              Mål: {activityHoursGoal} tim
            </span>
          )}
          <Input
            label="Aktiva timmar idag"
            type="number"
            min={0}
            max={24}
            step={0.5}
            value={hoursVal}
            onChange={(e) => setHoursVal(e.target.value)}
            onBlur={saveHours}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
            }}
            placeholder={`T.ex. ${activityHoursGoal}`}
            inputMode="decimal"
            disabled={pendingField}
          />
        </div>
      ) : null}

      {error ? <p className={styles.error}>{error}</p> : null}
    </Card>
  );
}
