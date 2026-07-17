"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";
import styles from "./NavProgress.module.scss";

interface NavPendingContextValue {
  setPending: (pending: boolean) => void;
}

const NavPendingContext = createContext<NavPendingContextValue | null>(null);

export function useNavPending() {
  const ctx = useContext(NavPendingContext);
  if (!ctx) {
    return { setPending: () => {} };
  }
  return ctx;
}

/**
 * Mirrors a local busy flag onto the global overlay.
 * Stays visible until `settleKey` changes after busy ends (covers router.refresh()).
 */
export function useSyncNavPending(busy: boolean, settleKey: unknown) {
  const { setPending } = useNavPending();
  const [holding, setHolding] = useState(false);
  const keyAtBusyStart = useRef(settleKey);
  const settleKeyRef = useRef(settleKey);
  settleKeyRef.current = settleKey;

  useEffect(() => {
    if (!busy) return;
    keyAtBusyStart.current = settleKeyRef.current;
    setHolding(true);
  }, [busy]);

  useEffect(() => {
    if (!holding || busy) return;
    if (settleKey === keyAtBusyStart.current) return;
    setHolding(false);
  }, [settleKey, holding, busy]);

  useEffect(() => {
    if (!holding || busy) return;
    const id = window.setTimeout(() => setHolding(false), 2500);
    return () => window.clearTimeout(id);
  }, [holding, busy, settleKey]);

  const show = busy || holding;

  useEffect(() => {
    if (!show) return;
    setPending(true);
    return () => setPending(false);
  }, [show, setPending]);
}

export function NavPendingProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [pending, setPendingState] = useState(false);
  const pendingCount = useRef(0);

  const setPending = useCallback((next: boolean) => {
    pendingCount.current = Math.max(0, pendingCount.current + (next ? 1 : -1));
    setPendingState(pendingCount.current > 0);
  }, []);

  useEffect(() => {
    pendingCount.current = 0;
    setPendingState(false);
  }, [pathname]);

  return (
    <NavPendingContext.Provider value={{ setPending }}>
      <div
        className={[styles.bar, pending ? styles.active : ""].filter(Boolean).join(" ")}
        aria-hidden
      />
      {pending ? (
        <div
          className={styles.overlay}
          role="status"
          aria-live="polite"
          aria-busy="true"
          aria-label="Laddar"
        >
          <span className={styles.spinner} aria-hidden />
        </div>
      ) : null}
      {children}
    </NavPendingContext.Provider>
  );
}
