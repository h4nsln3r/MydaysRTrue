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
import { EMPTY_PLAN_EXTRAS, type PlanListExtras } from "./plan-extras";

interface PlanExtrasContextValue {
  extras: PlanListExtras;
  ready: boolean;
  setExtras: (extras: PlanListExtras) => void;
}

const PlanExtrasContext = createContext<PlanExtrasContextValue | null>(null);

export function PlanExtrasProvider({ children }: { children: ReactNode }) {
  const [extras, setExtrasState] = useState<PlanListExtras>(EMPTY_PLAN_EXTRAS);
  const [ready, setReady] = useState(false);
  const setExtras = useCallback((next: PlanListExtras) => {
    setExtrasState(next);
    setReady(true);
  }, []);
  const value = useMemo(
    () => ({ extras, ready, setExtras }),
    [extras, ready, setExtras],
  );

  return (
    <PlanExtrasContext.Provider value={value}>{children}</PlanExtrasContext.Provider>
  );
}

export function usePlanExtras(): { extras: PlanListExtras; ready: boolean } {
  const value = useContext(PlanExtrasContext);
  if (!value) return { extras: EMPTY_PLAN_EXTRAS, ready: true };
  return { extras: value.extras, ready: value.ready };
}

/** Fills the provider once the deferred day-plan queries have resolved. */
export function PlanExtrasPublisher({ extras }: { extras: PlanListExtras }) {
  const value = useContext(PlanExtrasContext);
  const setExtras = value?.setExtras;
  useEffect(() => {
    setExtras?.(extras);
  }, [extras, setExtras]);
  return null;
}
