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
import { usePathname, useRouter } from "next/navigation";
import styles from "./NavProgress.module.scss";

interface NavPendingContextValue {
  setPending: (pending: boolean) => void;
  setBackgroundPending: (pending: boolean) => void;
  clearQueuedNavigation: () => void;
}

const NavPendingContext = createContext<NavPendingContextValue | null>(null);

const noopPending = {
  setPending: () => {},
  setBackgroundPending: () => {},
  clearQueuedNavigation: () => {},
};

export function useNavPending() {
  const ctx = useContext(NavPendingContext);
  return ctx ?? noopPending;
}

/**
 * Top bar only — no overlay. In-app links wait until `saving` finishes.
 */
export function useBackgroundSave(saving: boolean) {
  const { setBackgroundPending, clearQueuedNavigation } = useNavPending();

  useEffect(() => {
    if (!saving) return;
    setBackgroundPending(true);
    return () => setBackgroundPending(false);
  }, [saving, setBackgroundPending]);

  return { clearQueuedNavigation };
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

function internalNavHref(anchor: HTMLAnchorElement): string | null {
  const raw = anchor.getAttribute("href");
  if (!raw || raw.startsWith("#") || raw.startsWith("javascript:")) return null;
  if (anchor.target && anchor.target !== "_self") return null;
  if (anchor.hasAttribute("download")) return null;

  let url: URL;
  try {
    url = new URL(raw, window.location.href);
  } catch {
    return null;
  }
  if (url.origin !== window.location.origin) return null;

  const next = `${url.pathname}${url.search}${url.hash}`;
  const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  if (next === current) return null;
  return next;
}

export function NavPendingProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [pending, setPendingState] = useState(false);
  const [backgroundPending, setBackgroundPendingState] = useState(false);
  const [holdingNav, setHoldingNav] = useState(false);
  const pendingCount = useRef(0);
  const backgroundCount = useRef(0);
  const queuedHref = useRef<string | null>(null);
  const backgroundPendingRef = useRef(false);

  const setPending = useCallback((next: boolean) => {
    pendingCount.current = Math.max(0, pendingCount.current + (next ? 1 : -1));
    setPendingState(pendingCount.current > 0);
  }, []);

  const setBackgroundPending = useCallback((next: boolean) => {
    backgroundCount.current = Math.max(
      0,
      backgroundCount.current + (next ? 1 : -1),
    );
    setBackgroundPendingState(backgroundCount.current > 0);
  }, []);

  const clearQueuedNavigation = useCallback(() => {
    queuedHref.current = null;
    setHoldingNav(false);
  }, []);

  backgroundPendingRef.current = backgroundPending;

  useEffect(() => {
    pendingCount.current = 0;
    backgroundCount.current = 0;
    queuedHref.current = null;
    setPendingState(false);
    setBackgroundPendingState(false);
    setHoldingNav(false);
  }, [pathname]);

  useEffect(() => {
    if (backgroundPending) return;
    const href = queuedHref.current;
    if (!href) {
      setHoldingNav(false);
      return;
    }
    queuedHref.current = null;
    setHoldingNav(false);
    router.push(href);
  }, [backgroundPending, router]);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (!backgroundPendingRef.current) return;
      if (event.defaultPrevented) return;
      if (event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return;
      }
      const target = event.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest("a[href]");
      if (!(anchor instanceof HTMLAnchorElement)) return;
      const href = internalNavHref(anchor);
      if (!href) return;

      event.preventDefault();
      event.stopPropagation();
      queuedHref.current = href;
      setHoldingNav(true);
    };

    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  useEffect(() => {
    if (!backgroundPending) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [backgroundPending]);

  const showBar = pending || backgroundPending;
  const showOverlay = pending || holdingNav;

  return (
    <NavPendingContext.Provider
      value={{ setPending, setBackgroundPending, clearQueuedNavigation }}
    >
      <div
        className={[styles.bar, showBar ? styles.active : ""]
          .filter(Boolean)
          .join(" ")}
        aria-hidden
      />
      {showOverlay ? (
        <div
          className={styles.overlay}
          role="status"
          aria-live="polite"
          aria-busy="true"
          aria-label={holdingNav ? "Sparar innan sidbyte" : "Laddar"}
        >
          <span className={styles.spinner} aria-hidden />
        </div>
      ) : null}
      {children}
    </NavPendingContext.Provider>
  );
}
