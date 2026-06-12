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
      {children}
    </NavPendingContext.Provider>
  );
}
