import Link from "next/link";
import { addDaysISO, formatDayShort, formatWeekdayShort } from "@/lib/date";
import type { PeriodView } from "@/lib/period-view";
import styles from "./DayNav.module.scss";

export function dayPageHref(
  date: string,
  today: string,
  view: PeriodView,
): string {
  if (date === today) return view === "plan" ? "/?view=plan" : "/";
  return view === "plan" ? `/day/${date}?view=plan` : `/day/${date}`;
}

interface Props {
  date: string;
  today: string;
  view: PeriodView;
  kicker?: string;
}

export function DayNav({ date, today, view, kicker }: Props) {
  const prevDay = addDaysISO(date, -1);
  const nextDay = addDaysISO(date, 1);
  const canGoForward = nextDay <= today;
  const isToday = date === today;

  const title = isToday
    ? "Idag"
    : `${formatWeekdayShort(date)} · ${formatDayShort(date)}`;

  return (
    <div className={styles.wrap}>
      {kicker ? <p className={styles.kicker}>{kicker}</p> : null}
      <nav className={styles.nav} aria-label="Dag för dag">
        <Link
          href={dayPageHref(prevDay, today, view)}
          className={styles.navBtn}
          aria-label={`Föregående dag, ${formatDayShort(prevDay)}`}
        >
          ‹
        </Link>
        <span className={styles.title}>{title}</span>
        {canGoForward ? (
          <Link
            href={dayPageHref(nextDay, today, view)}
            className={styles.navBtn}
            aria-label={`Nästa dag, ${formatDayShort(nextDay)}`}
          >
            ›
          </Link>
        ) : (
          <span
            className={[styles.navBtn, styles.navBtnDisabled].join(" ")}
            aria-hidden
          >
            ›
          </span>
        )}
      </nav>
    </div>
  );
}
