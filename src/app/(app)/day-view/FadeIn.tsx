"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import styles from "./skeleton.module.scss";

interface PlanShownValue {
  ready: boolean;
  mark: () => void;
}

const PlanShownContext = createContext<PlanShownValue | null>(null);

export function PlanShownProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const mark = useCallback(() => setReady(true), []);
  const value = useMemo(() => ({ ready, mark }), [ready, mark]);
  return <PlanShownContext.Provider value={value}>{children}</PlanShownContext.Provider>;
}

/** The plan list. Marks the day as ready so the other sections can follow. */
export function MarkPlanShown({ children }: { children: ReactNode }) {
  const ctx = useContext(PlanShownContext);
  useEffect(() => {
    ctx?.mark();
  }, [ctx]);
  return <div className={styles.fadeIn}>{children}</div>;
}

/** Hidden until the plan list has painted, then fades in. */
export function RevealAfterPlan({ children }: { children: ReactNode }) {
  const ctx = useContext(PlanShownContext);
  const ready = ctx?.ready ?? true;
  const [shown, setShown] = useState(false);

  useEffect(() => {
    if (ready) setShown(true);
  }, [ready]);

  return <div className={shown ? styles.fadeIn : styles.hold}>{children}</div>;
}
