"use client";

import Link, { useLinkStatus } from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { fetchWeekDayJumpStatusesAction } from "@/app/(app)/week-day-jump-actions";
import { dayPageHref } from "@/components/DayNav/DayNav";
import { useNavPending } from "@/components/NavProgress/NavProgress";
import {
  addDaysISO,
  formatNavWeekBadge,
  isoWeekNumber,
  parseLocalISO,
  todayLocalISO,
  weekStartISO,
} from "@/lib/date";
import { parsePeriodView } from "@/lib/period-view";
import type {
  WeekDayJumpDayStatus,
  WeekDayScoreBand,
} from "@/lib/week-day-score";
import styles from "./WeekDayJump.module.scss";

const WEEKDAY_SHORT_SV = ["mån", "tis", "ons", "tor", "fre", "lör", "sön"] as const;

function activeDayFromPath(pathname: string, today: string): string | null {
  if (pathname === "/") return today;
  const match = pathname.match(/^\/day\/(\d{4}-\d{2}-\d{2})$/);
  return match?.[1] ?? null;
}

interface Props {
  onOpenChange?: (open: boolean) => void;
  forceClosed?: boolean;
}

export function WeekDayJump({ onOpenChange, forceClosed }: Props) {
  const [ready, setReady] = useState(false);
  const [open, setOpen] = useState(false);
  const [browseWeekStart, setBrowseWeekStart] = useState<string | null>(null);
  const [statuses, setStatuses] = useState<Record<string, WeekDayJumpDayStatus>>({});
  const [statusesLoading, setStatusesLoading] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const panelId = useId();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    setReady(true);
  }, []);

  const today = ready ? todayLocalISO() : null;
  const activeDate = today ? activeDayFromPath(pathname, today) : null;
  const currentWeekStart = today ? weekStartISO(parseLocalISO(today)) : null;

  useEffect(() => {
    if (forceClosed) setOpen(false);
  }, [forceClosed]);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    onOpenChange?.(open);
  }, [open, onOpenChange]);

  // Sync browsed week to the active day's week whenever the panel opens.
  useEffect(() => {
    if (!open || !activeDate) {
      setBrowseWeekStart(null);
      return;
    }
    setBrowseWeekStart(weekStartISO(parseLocalISO(activeDate)));
  }, [open, activeDate]);

  useEffect(() => {
    if (!open) return;

    const onDocClick = (event: MouseEvent) => {
      if (wrapRef.current?.contains(event.target as Node)) return;
      setOpen(false);
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  useEffect(() => {
    if (!open || !browseWeekStart) return;

    let cancelled = false;
    setStatusesLoading(true);
    void fetchWeekDayJumpStatusesAction(browseWeekStart)
      .then((rows) => {
        if (cancelled) return;
        const next: Record<string, WeekDayJumpDayStatus> = {};
        for (const row of rows) next[row.date] = row;
        setStatuses(next);
      })
      .catch(() => {
        if (!cancelled) setStatuses({});
      })
      .finally(() => {
        if (!cancelled) setStatusesLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, browseWeekStart]);

  if (!ready || !activeDate || !today || !currentWeekStart) {
    return <div className={styles.slot} aria-hidden />;
  }

  const view = parsePeriodView(searchParams.get("view") ?? undefined);
  const weekStart = browseWeekStart ?? weekStartISO(parseLocalISO(activeDate));
  const weekLabel = formatNavWeekBadge(weekStart);
  const canGoPrev = true;
  const canGoNext = weekStart < currentWeekStart;

  const days = Array.from({ length: 7 }, (_, i) => {
    const date = addDaysISO(weekStart, i);
    const status = statuses[date];
    return {
      date,
      weekday: WEEKDAY_SHORT_SV[i],
      dayNum: parseLocalISO(date).getDate(),
      isActive: date === activeDate,
      isToday: date === today,
      band: status?.band ?? null,
      pct: status?.pct,
      hit: status?.hit,
      total: status?.total,
    };
  });

  const shiftWeek = (deltaWeeks: number) => {
    setBrowseWeekStart((prev) => {
      const base = prev ?? weekStartISO(parseLocalISO(activeDate));
      const next = addDaysISO(base, deltaWeeks * 7);
      if (next > currentWeekStart) return currentWeekStart;
      return next;
    });
  };

  return (
    <div className={styles.wrap} ref={wrapRef}>
      <button
        type="button"
        className={[styles.trigger, open ? styles.triggerOpen : ""].filter(Boolean).join(" ")}
        aria-label={`Vecka ${weekLabel.slice(2)}, hoppa till dag`}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((prev) => !prev)}
      >
        <span className={styles.triggerLabel}>{weekLabel}</span>
        <span className={[styles.chevron, open ? styles.chevronOpen : ""].filter(Boolean).join(" ")} aria-hidden>
          ▾
        </span>
      </button>

      {open ? (
        <div className={styles.panel} id={panelId} role="navigation" aria-label="Veckans dagar">
          <div className={styles.weekBar}>
            <button
              type="button"
              className={styles.weekShift}
              aria-label={`Föregående vecka, v.${isoWeekNumber(parseLocalISO(addDaysISO(weekStart, -7)))}`}
              disabled={!canGoPrev}
              onClick={() => shiftWeek(-1)}
            >
              ‹
            </button>
            <span className={styles.weekBarLabel}>{weekLabel}</span>
            <button
              type="button"
              className={styles.weekShift}
              aria-label={
                canGoNext
                  ? `Nästa vecka, v.${isoWeekNumber(parseLocalISO(addDaysISO(weekStart, 7)))}`
                  : "Ingen senare vecka"
              }
              disabled={!canGoNext}
              onClick={() => shiftWeek(1)}
            >
              ›
            </button>
          </div>

          <div
            className={[styles.days, statusesLoading ? styles.daysLoading : ""]
              .filter(Boolean)
              .join(" ")}
          >
            {days.map((day, index) => (
              <DayChip
                key={day.date}
                weekday={day.weekday}
                dayNum={day.dayNum}
                isActive={day.isActive}
                isToday={day.isToday}
                band={day.band}
                pct={day.pct}
                hit={day.hit}
                total={day.total}
                href={dayPageHref(day.date, today, view)}
                index={index}
                onNavigate={() => setOpen(false)}
              />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function bandClass(band: WeekDayScoreBand | null): string {
  if (band === "good") return styles.dayGood;
  if (band === "mid") return styles.dayMid;
  if (band === "low") return styles.dayLow;
  if (band === "future") return styles.dayFuture;
  return "";
}

function DayChip({
  weekday,
  dayNum,
  isActive,
  isToday,
  band,
  pct,
  hit,
  total,
  href,
  index,
  onNavigate,
}: {
  weekday: string;
  dayNum: number;
  isActive: boolean;
  isToday: boolean;
  band: WeekDayScoreBand | null;
  pct?: number;
  hit?: number;
  total?: number;
  href: string;
  index: number;
  onNavigate: () => void;
}) {
  const className = [
    styles.day,
    bandClass(band),
    isActive ? styles.dayActive : "",
    isToday && !isActive ? styles.dayToday : "",
  ]
    .filter(Boolean)
    .join(" ");

  const title =
    band && band !== "future" && pct != null && hit != null && total != null
      ? `${hit}/${total} klart (${pct}%)`
      : band === "future"
        ? "Kommande dag"
        : undefined;

  const showProgress =
    band != null && band !== "future" && pct != null;

  const body = (
    <>
      {showProgress ? (
        <span
          className={styles.fill}
          style={{ "--pct": pct } as CSSProperties}
          aria-hidden
        />
      ) : null}
      <span className={styles.weekday}>{weekday}</span>
      <span className={styles.dayNum}>{dayNum}</span>
      {showProgress ? (
        <span className={styles.pctBadge} aria-hidden>
          {pct}
        </span>
      ) : null}
    </>
  );

  if (isActive) {
    return (
      <span
        className={className}
        style={{ "--i": index } as CSSProperties}
        aria-current="date"
        title={title}
      >
        {body}
      </span>
    );
  }

  return (
    <Link
      href={href}
      prefetch
      className={className}
      style={{ "--i": index } as CSSProperties}
      aria-label={
        title ? `${weekday} ${dayNum}, ${title}` : `${weekday} ${dayNum}`
      }
      title={title}
      onClick={onNavigate}
    >
      <DayChipPending />
      {body}
    </Link>
  );
}

function DayChipPending() {
  const { pending } = useLinkStatus();
  const { setPending } = useNavPending();

  useEffect(() => {
    setPending(pending);
    return () => setPending(false);
  }, [pending, setPending]);

  return null;
}
