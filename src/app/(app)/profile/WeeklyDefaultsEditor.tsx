"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateCardioDefaultWeekdayAction } from "@/app/(app)/cardio-actions";
import { updateGymDefaultWeekdayAction } from "@/app/(app)/gym-actions";
import { updateWeeklyTaskAction } from "@/app/(app)/tasks-actions";
import { updateWeightDefaultWeekdayAction } from "@/app/(app)/weight-actions";
import { DefaultWeekdaySelect } from "@/components/DefaultWeekdaySelect/DefaultWeekdaySelect";
import type { CardioSessionTemplate } from "@/lib/cardio";
import type { GymSessionTemplate } from "@/lib/gym";
import { WEEKDAY_SHORT, type Weekday, type WeeklyTask } from "@/lib/tasks";
import styles from "./profile.module.scss";

interface Props {
  gymTemplates: GymSessionTemplate[];
  cardioTemplates: CardioSessionTemplate[];
  weeklyTasks: WeeklyTask[];
  weightDefaultWeekday: Weekday | null;
}

export function WeeklyDefaultsEditor({
  gymTemplates,
  cardioTemplates,
  weeklyTasks,
  weightDefaultWeekday,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const saveGym = (templateId: string, defaultWeekday: Weekday | null) => {
    if (defaultWeekday == null) return;
    setError(null);
    startTransition(async () => {
      const res = await updateGymDefaultWeekdayAction({
        templateId,
        defaultWeekday,
      });
      if (!res.ok) setError(res.error ?? "Kunde inte spara.");
      router.refresh();
    });
  };

  const saveCardio = (templateId: string, defaultWeekday: Weekday | null) => {
    if (defaultWeekday == null) return;
    setError(null);
    startTransition(async () => {
      const res = await updateCardioDefaultWeekdayAction({
        templateId,
        defaultWeekday,
      });
      if (!res.ok) setError(res.error ?? "Kunde inte spara.");
      router.refresh();
    });
  };

  const saveTask = (taskId: string, defaultWeekday: Weekday | null) => {
    setError(null);
    startTransition(async () => {
      const res = await updateWeeklyTaskAction({ id: taskId, defaultWeekday });
      if (!res.ok) setError(res.error ?? "Kunde inte spara.");
      router.refresh();
    });
  };

  const saveWeight = (defaultWeekday: Weekday | null) => {
    setError(null);
    startTransition(async () => {
      const res = await updateWeightDefaultWeekdayAction(defaultWeekday);
      if (!res.ok) setError(res.error ?? "Kunde inte spara.");
      router.refresh();
    });
  };

  const hasAny =
    gymTemplates.length > 0 ||
    cardioTemplates.length > 0 ||
    weeklyTasks.length > 0;

  if (!hasAny) return null;

  return (
    <div className={styles.subBlock}>
      <header className={styles.subHeader}>
        <h4 className={styles.h4}>Standarddagar</h4>
        <span className={styles.muted}>varje aktivitet placeras här vid ny vecka</span>
      </header>

      {error ? <p className={styles.error}>{error}</p> : null}

      {gymTemplates.length > 0 ? (
        <section className={styles.defaultsSection}>
          <h5 className={styles.defaultsHeading}>Gym</h5>
          <ul className={styles.defaultsList}>
            {gymTemplates.map((t) => (
              <li key={t.id} className={styles.defaultsRow}>
                <span className={styles.defaultsLabel}>
                  <span className={styles.habitIcon} aria-hidden style={{ borderColor: t.accent }}>
                    {t.icon}
                  </span>
                  {t.label}
                </span>
                <DefaultWeekdaySelect
                  id={`gym-default-${t.id}`}
                  value={t.defaultWeekday}
                  onChange={(d) => saveGym(t.id, d)}
                  disabled={pending}
                  allowNone={false}
                />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {cardioTemplates.length > 0 ? (
        <section className={styles.defaultsSection}>
          <h5 className={styles.defaultsHeading}>Cardio</h5>
          <ul className={styles.defaultsList}>
            {cardioTemplates.map((t) => (
              <li key={t.id} className={styles.defaultsRow}>
                <span className={styles.defaultsLabel}>
                  <span className={styles.habitIcon} aria-hidden style={{ borderColor: t.accent }}>
                    {t.icon}
                  </span>
                  {t.label}
                </span>
                <DefaultWeekdaySelect
                  id={`cardio-default-${t.id}`}
                  value={t.defaultWeekday}
                  onChange={(d) => saveCardio(t.id, d)}
                  disabled={pending}
                  allowNone={false}
                />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {weeklyTasks.length > 0 ? (
        <section className={styles.defaultsSection}>
          <h5 className={styles.defaultsHeading}>Veckouppgifter</h5>
          <ul className={styles.defaultsList}>
            {weeklyTasks.map((t) => (
              <li key={t.id} className={styles.defaultsRow}>
                <span className={styles.defaultsLabel}>
                  <span className={styles.habitIcon} aria-hidden style={{ borderColor: t.accent }}>
                    {t.icon}
                  </span>
                  {t.title}
                  {t.defaultWeekday ? (
                    <span className={styles.defaultsHint}>
                      ({WEEKDAY_SHORT[t.defaultWeekday]})
                    </span>
                  ) : null}
                </span>
                <DefaultWeekdaySelect
                  id={`task-default-${t.id}`}
                  value={t.defaultWeekday}
                  onChange={(d) => saveTask(t.id, d)}
                  disabled={pending}
                />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className={styles.defaultsSection}>
        <h5 className={styles.defaultsHeading}>Vikt</h5>
        <div className={styles.defaultsRow}>
          <span className={styles.defaultsLabel}>
            <span className={styles.habitIcon} aria-hidden>
              ⚖️
            </span>
            Veckovägning
          </span>
          <DefaultWeekdaySelect
            id="weight-default"
            value={weightDefaultWeekday}
            onChange={saveWeight}
            disabled={pending}
          />
        </div>
      </section>
    </div>
  );
}
