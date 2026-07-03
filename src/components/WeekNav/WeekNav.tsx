"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { PeriodNavTitle } from "@/components/PeriodBadge/PeriodBadge";
import {
  weekNavHref,
  weekNavKicker,
  weekNavState,
} from "@/lib/week-nav";
import type { PeriodView } from "@/lib/period-view";
import styles from "./WeekNav.module.scss";

interface Props {
  weekStart: string;
  currentWeekStart: string;
  view: PeriodView;
  title: string;
  maxWeekStart?: string;
}

export function WeekNav({
  weekStart,
  currentWeekStart,
  view,
  title,
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
      <p className={styles.kicker}>
        {weekNavKicker(weekStart, currentWeekStart)}
      </p>
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
        <h1 className={styles.h1}>
          <PeriodNavTitle kind="week" date={weekStart}>
            {title}
          </PeriodNavTitle>
        </h1>
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
