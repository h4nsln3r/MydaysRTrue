import Link from "next/link";
import { ProgressPlanTabs } from "@/components/ProgressPlanTabs/ProgressPlanTabs";
import { addDaysISO, formatDayShort } from "@/lib/date";
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
  heading?: string;
}

export function DayNav({ date, today, view, kicker, heading }: Props) {
  const prevDay = addDaysISO(date, -1);
  const nextDay = addDaysISO(date, 1);

  return (
    <div className={styles.wrap}>
      {heading ? <h2 className={styles.heading}>{heading}</h2> : null}
      {kicker ? <p className={styles.kicker}>{kicker}</p> : null}
      <nav className={styles.nav} aria-label="Dag för dag">
        <Link
          href={dayPageHref(prevDay, today, view)}
          className={styles.navBtn}
          aria-label={`Föregående dag, ${formatDayShort(prevDay)}`}
        >
          ‹
        </Link>
        <div className={styles.titleCell}>
          <ProgressPlanTabs
            view={view}
            progressHref={dayPageHref(date, today, "progress")}
            planHref={dayPageHref(date, today, "plan")}
          />
        </div>
        <Link
          href={dayPageHref(nextDay, today, view)}
          className={styles.navBtn}
          aria-label={`Nästa dag, ${formatDayShort(nextDay)}`}
        >
          ›
        </Link>
      </nav>
    </div>
  );
}
