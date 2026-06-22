"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/Card/Card";
import { BathingExtraBath } from "@/components/BathingDayCard/BathingDayCard";
import { WeeklyTaskQuickAdd } from "@/components/WeeklyTasksDayCard/WeeklyTasksDayCard";
import type { BathingSessionForWeek } from "@/lib/bathing";
import type { CardioSessionForWeek } from "@/lib/cardio";
import {
  buildDayActivities,
  dayActivityKey,
} from "@/lib/day-activities";
import { addDaysISO, formatDayLong, isoWeekdayFromLocalISO } from "@/lib/date";
import type { GymSessionForWeek } from "@/lib/gym";
import type { SportSessionForWeek } from "@/lib/sport";
import type { TaskCategory, Weekday, WeeklyTaskForWeek } from "@/lib/tasks";
import type { WeightDayContext } from "@/lib/weight";
import { DayActivityRow } from "./DayActivityRow";
import type { RescheduleDay } from "./types";
import styles from "@/components/WeeklyTasksDayCard/WeeklyTasksDayCard.module.scss";

interface Props {
  weekStart: string;
  tasks: WeeklyTaskForWeek[];
  gymSessions: GymSessionForWeek[];
  cardioSessions: CardioSessionForWeek[];
  sportSessions: SportSessionForWeek[];
  bathingSessions: BathingSessionForWeek[];
  weight: WeightDayContext;
  categories: TaskCategory[];
  date?: string;
  today?: string;
  title?: string;
  hideWhenEmpty?: boolean;
  showWeekLink?: boolean;
  enableQuickAdd?: boolean;
  bathingWeekday?: Weekday | null;
  enableExtraBath?: boolean;
}

export function DayActivitiesCard({
  weekStart,
  tasks,
  gymSessions,
  cardioSessions,
  sportSessions,
  bathingSessions,
  weight,
  categories,
  date,
  today,
  title = "Idag",
  hideWhenEmpty = false,
  showWeekLink = true,
  enableQuickAdd = false,
  bathingWeekday = null,
  enableExtraBath = false,
}: Props) {
  const router = useRouter();
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending] = useTransition();

  const [afterEight, setAfterEight] = useState(false);
  useEffect(() => {
    setAfterEight(new Date().getHours() >= 20);
  }, []);

  const isOverdue = date != null && today != null && date < today;
  const isToday = date != null && today != null && date === today;
  const canReschedule = isOverdue || (isToday && afterEight);

  const items = useMemo(
    () =>
      buildDayActivities({
        tasks,
        gymSessions,
        cardioSessions,
        sportSessions,
        bathingSessions,
        weight,
      }),
    [
      tasks,
      gymSessions,
      cardioSessions,
      sportSessions,
      bathingSessions,
      weight,
    ],
  );

  const doneCount = items.filter((i) => i.doneAt).length;

  const quickAddWeekday =
    enableQuickAdd && date != null
      ? (isoWeekdayFromLocalISO(date) as Weekday)
      : null;

  const showExtraBath = enableExtraBath && bathingWeekday != null;

  const rescheduleDays = useMemo<RescheduleDay[]>(() => {
    if (!today) return [];
    return Array.from({ length: 7 }, (_, i) => addDaysISO(weekStart, i))
      .filter((iso) => iso > today || (isOverdue && iso === today))
      .map((iso) => ({
        weekday: isoWeekdayFromLocalISO(iso) as Weekday,
        label: iso === today ? "Idag" : formatDayLong(iso),
      }));
  }, [weekStart, today, isOverdue]);

  const quickAdd =
    quickAddWeekday != null ? (
      <WeeklyTaskQuickAdd
        weekStart={weekStart}
        weekday={quickAddWeekday}
        categories={categories}
        onAdded={() => router.refresh()}
      />
    ) : null;

  const extraBath = showExtraBath ? (
    <BathingExtraBath
      weekStart={weekStart}
      weekday={bathingWeekday}
      onAdded={() => router.refresh()}
    />
  ) : null;

  if (items.length === 0) {
    if (hideWhenEmpty) {
      if (!quickAdd && !extraBath) return null;
      return (
        <Card className={styles.card}>
          {quickAdd}
          {extraBath}
        </Card>
      );
    }

    return (
      <Card className={styles.card}>
        <p className={styles.empty}>Inget planerat idag.</p>
        {quickAdd}
        {extraBath}
        {showWeekLink ? (
          <Link
            href={`/week?start=${weekStart}&view=plan`}
            className={styles.weekLink}
          >
            Se veckoplan →
          </Link>
        ) : null}
      </Card>
    );
  }

  return (
    <Card className={styles.card}>
      <header className={styles.header}>
        <div className={styles.titleRow}>
          <h2 className={styles.title}>{title}</h2>
          <span
            className={[
              styles.counter,
              doneCount === items.length ? styles.counterDone : "",
              doneCount > 0 && doneCount < items.length
                ? styles.counterPartial
                : "",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            <span className={styles.counterBig}>{doneCount}</span>
            <span className={styles.counterSlash}>/ {items.length}</span>
          </span>
        </div>
        {showWeekLink ? (
          <Link
            href={`/week?start=${weekStart}&view=plan`}
            className={styles.weekLink}
          >
            Veckoplan →
          </Link>
        ) : null}
      </header>

      {error ? <p className={styles.error}>{error}</p> : null}

      <ul className={styles.list}>
        {items.map((item) => {
          const key = dayActivityKey(item);
          return (
            <DayActivityRow
              key={key}
              item={item}
              weekStart={weekStart}
              categories={categories}
              canReschedule={canReschedule}
              isOverdue={isOverdue}
              rescheduleDays={rescheduleDays}
              expanded={expandedKey === key}
              busy={pendingKey === key}
              pending={pending}
              onToggleExpand={() =>
                setExpandedKey(expandedKey === key ? null : key)
              }
              onError={setError}
              onPendingId={(id) => setPendingKey(id ? key : null)}
              onRefresh={() => router.refresh()}
              onDone={() => {
                setExpandedKey(null);
                router.refresh();
              }}
            />
          );
        })}
      </ul>

      {quickAdd}
      {extraBath}
    </Card>
  );
}
