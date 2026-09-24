"use client";

import Link, { useLinkStatus } from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { signOutAction } from "@/app/(app)/actions";
import { useNavPending } from "@/components/NavProgress/NavProgress";
import { PeriodBadge } from "@/components/PeriodBadge/PeriodBadge";
import { WeekDayJump } from "@/components/WeekDayJump/WeekDayJump";
import {
  addDaysISO,
  formatDayShort,
  formatNavMonthBadge,
  formatWeekdayShort,
  parseLocalISO,
  todayLocalISO,
  weekStartISO,
} from "@/lib/date";
import type { PeriodView } from "@/lib/period-view";
import styles from "./AppMenu.module.scss";

interface ViewRoute {
  href: string;
  label: string;
  view: PeriodView;
  match: (pathname: string) => boolean;
}

interface MenuRoute {
  href: string;
  label: string;
  icon: ReactNode;
  isActive: (pathname: string) => boolean;
}

const viewRoutes: ViewRoute[] = [
  { href: "/", label: "Dagvy", view: "progress", match: (p) => p === "/" || p.startsWith("/day") },
  { href: "/?view=plan", label: "DagPlan", view: "plan", match: (p) => p === "/" || p.startsWith("/day") },
  { href: "/week", label: "VeckoVy", view: "progress", match: (p) => p.startsWith("/week") },
  { href: "/week?view=plan", label: "VeckoPlan", view: "plan", match: (p) => p.startsWith("/week") },
  { href: "/month", label: "MånadsVy", view: "progress", match: (p) => p.startsWith("/month") },
  { href: "/month?view=plan", label: "Månadsplan", view: "plan", match: (p) => p.startsWith("/month") },
  { href: "/year", label: "Årsvy", view: "progress", match: (p) => p.startsWith("/year") },
  { href: "/year?view=plan", label: "ÅrsPlan", view: "plan", match: (p) => p.startsWith("/year") },
];

const menuRoutes: MenuRoute[] = [
  {
    href: "/profile",
    label: "Profile",
    icon: <UserIcon />,
    isActive: (pathname) => pathname === "/profile",
  },
  {
    href: "/settings/tasks",
    label: "Task settings",
    icon: <TasksIcon />,
    isActive: (pathname) => pathname.startsWith("/settings/tasks"),
  },
  {
    href: "/settings",
    label: "Settings",
    icon: <SettingsIcon />,
    isActive: (pathname) =>
      (pathname.startsWith("/settings") &&
        !pathname.startsWith("/settings/tasks")) ||
      pathname.startsWith("/profile/"),
  },
];

export function AppMenu() {
  const [phase, setPhase] = useState<"closed" | "open" | "closing">("closed");
  const open = phase !== "closed";
  const closing = phase === "closing";
  const wrapRef = useRef<HTMLDivElement>(null);

  const closeMenu = useCallback(() => {
    setPhase((current) => {
      if (current !== "open") return current;
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        return "closed";
      }
      return "closing";
    });
  }, []);

  const toggleMenu = useCallback(() => {
    setPhase((current) => {
      if (current !== "open") return "open";
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        return "closed";
      }
      return "closing";
    });
  }, []);
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const currentView: PeriodView =
    searchParams.get("view") === "plan" ? "plan" : "progress";
  const menuActive = menuRoutes.some((route) => route.isActive(pathname));

  const onWeekJumpOpenChange = useCallback(
    (next: boolean) => {
      if (next) closeMenu();
    },
    [closeMenu],
  );

  useEffect(() => {
    for (const route of viewRoutes) router.prefetch(route.href);
    for (const route of menuRoutes) router.prefetch(route.href);
  }, [router]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    closeMenu();
  }, [pathname, closeMenu]);

  useEffect(() => {
    if (phase !== "open") return;

    const onDocClick = (event: MouseEvent) => {
      if (wrapRef.current?.contains(event.target as Node)) return;
      closeMenu();
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeMenu();
    };

    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [phase, closeMenu]);

  return (
    <div className={styles.bar}>
      <div className={styles.barInner}>
        <WeekDayJump
          onOpenChange={onWeekJumpOpenChange}
          forceClosed={open}
        />

        <PeriodBarTitle pathname={pathname} searchParams={searchParams} />

        <div className={styles.wrap} ref={wrapRef}>
          <button
            type="button"
            className={[
              styles.menuBtn,
              open ? styles.menuBtnOpen : "",
              menuActive ? styles.menuBtnActive : "",
            ]
              .filter(Boolean)
              .join(" ")}
            aria-label="Meny"
            aria-expanded={open}
            aria-haspopup="menu"
            onClick={toggleMenu}
          >
            <MenuIcon />
          </button>

          {open ? (
            <>
              <button
                type="button"
                className={[
                  styles.backdrop,
                  closing ? styles.backdropClosing : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                aria-label="Stäng meny"
                tabIndex={-1}
                onClick={closeMenu}
              />
              <div
                className={[styles.panel, closing ? styles.panelClosing : ""]
                  .filter(Boolean)
                  .join(" ")}
                role="menu"
                onAnimationEnd={(event) => {
                  if (event.target !== event.currentTarget || !closing) return;
                  setPhase("closed");
                }}
              >
                <div className={styles.panelHead}>
                  <p className={styles.kicker}>Hoppa till</p>
                  <button
                    type="button"
                    className={styles.closeBtn}
                    aria-label="Stäng meny"
                    onClick={closeMenu}
                  >
                    <CloseIcon />
                  </button>
                </div>
                <div className={styles.viewList}>
                  {viewRoutes.map((route, index) => (
                    <ViewItem
                      key={route.href}
                      route={route}
                      index={index}
                      active={
                        route.match(pathname) && route.view === currentView
                      }
                      closing={closing}
                      onNavigate={closeMenu}
                    />
                  ))}
                </div>
                <div className={styles.divider} role="separator" />
                <div className={styles.settingsList}>
                  {menuRoutes.map((route) => (
                    <MenuItem
                      key={route.href}
                      route={route}
                      onNavigate={closeMenu}
                    />
                  ))}
                </div>
                <div className={styles.signOutSpacer} />
                <div className={styles.signOutBlock}>
                  <div className={styles.divider} role="separator" />
                  <SignOutItem />
                </div>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function ViewItem({
  route,
  index,
  active,
  closing,
  onNavigate,
}: {
  route: ViewRoute;
  index: number;
  active: boolean;
  closing: boolean;
  onNavigate: () => void;
}) {
  return (
    <Link
      href={route.href}
      prefetch
      className={[styles.viewLink, closing ? styles.viewLinkClosing : ""]
        .filter(Boolean)
        .join(" ")}
      role="menuitem"
      aria-current={active ? "page" : undefined}
      onClick={onNavigate}
      style={{
        animationDelay: closing
          ? `${(viewRoutes.length - 1 - index) * 18}ms`
          : `${40 + index * 35}ms`,
      }}
    >
      <ViewItemLabel
        active={active}
        label={route.label}
        view={route.view}
      />
    </Link>
  );
}

function ViewItemLabel({
  active,
  label,
  view,
}: {
  active: boolean;
  label: string;
  view: PeriodView;
}) {
  const { pending } = useLinkStatus();
  const { setPending } = useNavPending();

  useEffect(() => {
    setPending(pending);
    return () => setPending(false);
  }, [pending, setPending]);

  return (
    <span
      className={[
        styles.viewItem,
        active ? styles.viewItemActive : "",
        pending ? styles.menuItemPending : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <span className={styles.viewLabel}>{label}</span>
      <span className={styles.viewTag}>{view === "plan" ? "plan" : "vy"}</span>
    </span>
  );
}

function dayBarDate(pathname: string): string | null {
  if (pathname === "/") return todayLocalISO();
  const match = pathname.match(/^\/day\/(\d{4}-\d{2}-\d{2})$/);
  return match?.[1] ?? null;
}

function dayBarLabel(date: string, today: string): string {
  if (date === today) return "Idag";
  if (date > today) return `${formatWeekdayShort(date)} · planera`;
  return `${formatWeekdayShort(date)} · ${formatDayShort(date)}`;
}

function PeriodBarTitle({
  pathname,
  searchParams,
}: {
  pathname: string;
  searchParams: { get: (key: string) => string | null };
}) {
  const today = todayLocalISO();
  const dayDate = dayBarDate(pathname);

  if (dayDate) {
    return (
      <div className={styles.daySlot}>
        <span className={styles.dayTitle}>{dayBarLabel(dayDate, today)}</span>
        <PeriodBadge kind="day" date={dayDate} variant="header" />
      </div>
    );
  }

  if (pathname.startsWith("/week")) {
    const raw = searchParams.get("start");
    const weekStart =
      raw && /^\d{4}-\d{2}-\d{2}$/.test(raw)
        ? weekStartISO(parseLocalISO(raw))
        : weekStartISO();
    return (
      <div className={styles.daySlot}>
        <span className={styles.dayTitle}>{weekBarLabel(weekStart)}</span>
        <PeriodBadge kind="week" date={weekStart} variant="header" />
      </div>
    );
  }

  if (pathname.startsWith("/month")) {
    const raw = searchParams.get("m");
    const match = raw?.match(/^(\d{4})-(\d{2})$/);
    const year = match ? Number(match[1]) : Number(today.slice(0, 4));
    const month = match ? Number(match[2]) : Number(today.slice(5, 7));
    const date = `${year}-${String(month).padStart(2, "0")}-01`;
    return (
      <div className={styles.daySlot}>
        <span className={styles.dayTitle}>{monthBarLabel(date, today)}</span>
        <PeriodBadge kind="month" date={date} variant="header" />
      </div>
    );
  }

  if (pathname.startsWith("/year")) {
    const raw = searchParams.get("y");
    const year = raw && /^\d{4}$/.test(raw) ? Number(raw) : Number(today.slice(0, 4));
    const date = `${year}-01-01`;
    return (
      <div className={styles.daySlot}>
        <span className={styles.dayTitle}>{yearBarLabel(year, today)}</span>
        <PeriodBadge kind="year" date={date} variant="header" />
      </div>
    );
  }

  return <div className={styles.daySlot} />;
}

function weekBarLabel(weekStart: string): string {
  const current = weekStartISO();
  if (weekStart === current) return "Veckan";
  if (weekStart === addDaysISO(current, 7)) return "Nästa";
  const end = addDaysISO(weekStart, 6);
  const startDay = String(Number(weekStart.slice(8, 10)));
  return `${startDay}–${formatDayShort(end)}`;
}

function monthBarLabel(monthDate: string, today: string): string {
  if (monthDate.slice(0, 7) === today.slice(0, 7)) return "Månaden";
  return formatNavMonthBadge(monthDate);
}

function yearBarLabel(year: number, today: string): string {
  if (year === Number(today.slice(0, 4))) return "Året";
  return String(year);
}

function SignOutItem() {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      className={[styles.signOut, pending ? styles.menuItemPending : ""]
        .filter(Boolean)
        .join(" ")}
      role="menuitem"
      disabled={pending}
      onClick={() => startTransition(() => signOutAction())}
    >
      {pending ? "Loggar ut…" : "Logga ut"}
    </button>
  );
}

function MenuItem({
  route,
  onNavigate,
}: {
  route: MenuRoute;
  onNavigate: () => void;
}) {
  const pathname = usePathname();
  const active = route.isActive(pathname);

  return (
    <Link
      href={route.href}
      prefetch
      className={styles.menuItemLink}
      role="menuitem"
      aria-current={active ? "page" : undefined}
      onClick={onNavigate}
    >
      <MenuItemLabel active={active} icon={route.icon} label={route.label} />
    </Link>
  );
}

function MenuItemLabel({
  active,
  icon,
  label,
}: {
  active: boolean;
  icon: ReactNode;
  label: string;
}) {
  const { pending } = useLinkStatus();
  const { setPending } = useNavPending();

  useEffect(() => {
    setPending(pending);
    return () => setPending(false);
  }, [pending, setPending]);

  return (
    <span
      className={[
        styles.menuItem,
        active ? styles.menuItemActive : "",
        pending ? styles.menuItemPending : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {icon}
      {label}
    </span>
  );
}

function CloseIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M6 6l12 12M18 6 6 18"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function MenuIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M5 7h14M5 12h14M5 17h14"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function UserIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="9" r="3.5" stroke="currentColor" strokeWidth="2" />
      <path
        d="M5 20c1.2-3.4 4-5 7-5s5.8 1.6 7 5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" />
      <path
        d="M12 2v2M12 20v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M2 12h2M20 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function TasksIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M9 6h11M9 12h11M9 18h11"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M4.5 6.5 5.5 7.5 7.5 5.5M4.5 12.5 5.5 13.5 7.5 11.5M4.5 18.5 5.5 19.5 7.5 17.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
