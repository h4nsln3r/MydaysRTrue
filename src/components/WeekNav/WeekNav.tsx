"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { ProgressPlanTabs } from "@/components/ProgressPlanTabs/ProgressPlanTabs";
import { weekNavHref, weekNavState } from "@/lib/week-nav";
import type { PeriodView } from "@/lib/period-view";
import styles from "./WeekNav.module.scss";

interface Props {
  weekStart: string;
  currentWeekStart: string;
  view: PeriodView;
  maxWeekStart?: string;
}

export function WeekNav({
  weekStart,
  currentWeekStart,
  view,
  maxWeekStart,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const { prevStart, nextStart, canGoForward } = weekNavState(
    weekStart,
    currentWeekStart,
    maxWeekStart,
  );

  const go = (href: string) => {
    startTransition(() => {
      router.push(href);
      router.refresh();
    });
  };

  return (
    <header className={styles.header}>
      <nav className={styles.weekNav} aria-label="Veckonavigation">
        <button
          type="button"
          className={styles.navBtn}
          aria-label="Föregående vecka"
          disabled={pending}
          onClick={() => go(weekNavHref(prevStart, view))}
        >
          ‹
        </button>
        <div className={styles.titleCell}>
          <ProgressPlanTabs
            view={view}
            progressHref={weekNavHref(weekStart, "progress")}
            planHref={weekNavHref(weekStart, "plan")}
          />
        </div>
        {canGoForward ? (
          <button
            type="button"
            className={styles.navBtn}
            aria-label="Nästa vecka"
            disabled={pending}
            onClick={() => go(weekNavHref(nextStart, view))}
          >
            ›
          </button>
        ) : (
          <span
            className={[styles.navBtn, styles.navBtnDisabled].join(" ")}
            aria-hidden
          >
            ›
          </span>
        )}
      </nav>
    </header>
  );
}
