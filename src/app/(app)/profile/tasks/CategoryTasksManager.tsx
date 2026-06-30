"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  setMonthlyTaskEnabledAction,
  setWeeklyTaskEnabledAction,
} from "@/app/(app)/tasks-actions";
import type { MonthlyTask, TaskCategory, WeeklyTask, Weekday } from "@/lib/tasks";
import { WEEKDAY_LONG } from "@/lib/tasks";
import styles from "./profile.module.scss";

interface Props {
  categories: TaskCategory[];
  weeklyTasks: WeeklyTask[];
  monthlyTasks: MonthlyTask[];
}

export function CategoryTasksManager({
  categories,
  weeklyTasks,
  monthlyTasks,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const toggleWeekly = (taskId: string, enabled: boolean) => {
    startTransition(async () => {
      const res = await setWeeklyTaskEnabledAction({ taskId, enabled: !enabled });
      if (res.ok) router.refresh();
    });
  };

  const toggleMonthly = (taskId: string, enabled: boolean) => {
    startTransition(async () => {
      const res = await setMonthlyTaskEnabledAction({ taskId, enabled: !enabled });
      if (res.ok) router.refresh();
    });
  };

  const groups = buildCategoryGroups(categories, weeklyTasks, monthlyTasks);

  if (groups.length === 0) {
    return (
      <p className={styles.emptyNote}>
        Inga vecko- eller månadsuppgifter ännu. Skapa mallar under profil eller
        engångsuppgifter i vecko-/månadsvyn.
      </p>
    );
  }

  return (
    <div className={styles.stack}>
      {groups.map((group) => (
        <section key={group.id} className={styles.categoryTasksGroup}>
          <header className={styles.categoryTasksHeader}>
            <span
              className={styles.categoryTasksChip}
              style={{
                borderColor: group.category?.accent ?? "transparent",
                color: group.category?.accent ?? undefined,
              }}
            >
              <span aria-hidden>{group.category?.icon ?? "•"}</span>
              <span>{group.category?.name ?? "Ingen kategori"}</span>
            </span>
            <span className={styles.muted}>
              {group.weekly.length} vecka · {group.monthly.length} månad
            </span>
          </header>

          {group.weekly.length > 0 ? (
            <div className={styles.categoryTasksSection}>
              <h4 className={styles.categoryTasksSectionTitle}>Veckouppgifter</h4>
              <ul className={styles.habitList}>
                {group.weekly.map((task) => (
                  <li
                    key={task.id}
                    className={[
                      styles.habitItem,
                      !task.enabled ? styles.habitItemDisabled : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    <span
                      className={styles.habitIcon}
                      aria-hidden
                      style={{ borderColor: task.accent }}
                    >
                      {task.icon}
                    </span>
                    <div className={styles.habitText}>
                      <span className={styles.habitLabel}>{task.title}</span>
                      {task.defaultWeekday != null ? (
                        <span className={styles.habitKind}>
                          Standarddag:{" "}
                          {WEEKDAY_LONG[task.defaultWeekday as Weekday]}
                        </span>
                      ) : !task.enabled ? (
                        <span className={styles.habitKind}>Inaktiverad</span>
                      ) : null}
                    </div>
                    <button
                      type="button"
                      role="switch"
                      className={[
                        styles.habitToggle,
                        task.enabled ? styles.habitToggleOn : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      aria-checked={task.enabled}
                      aria-label={`${task.enabled ? "Stäng av" : "Slå på"} ${task.title}`}
                      disabled={pending}
                      onClick={() => toggleWeekly(task.id, task.enabled)}
                    >
                      <span className={styles.habitToggleKnob} aria-hidden />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {group.monthly.length > 0 ? (
            <div className={styles.categoryTasksSection}>
              <h4 className={styles.categoryTasksSectionTitle}>Månadsuppgifter</h4>
              <ul className={styles.habitList}>
                {group.monthly.map((task) => (
                  <li
                    key={task.id}
                    className={[
                      styles.habitItem,
                      !task.enabled ? styles.habitItemDisabled : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    <span
                      className={styles.habitIcon}
                      aria-hidden
                      style={{ borderColor: task.accent }}
                    >
                      {task.icon}
                    </span>
                    <div className={styles.habitText}>
                      <span className={styles.habitLabel}>{task.title}</span>
                      {task.dayOfMonth != null ? (
                        <span className={styles.habitKind}>
                          Föreslagen dag: {task.dayOfMonth}
                        </span>
                      ) : !task.enabled ? (
                        <span className={styles.habitKind}>Inaktiverad</span>
                      ) : null}
                    </div>
                    <button
                      type="button"
                      role="switch"
                      className={[
                        styles.habitToggle,
                        task.enabled ? styles.habitToggleOn : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      aria-checked={task.enabled}
                      aria-label={`${task.enabled ? "Stäng av" : "Slå på"} ${task.title}`}
                      disabled={pending}
                      onClick={() => toggleMonthly(task.id, task.enabled)}
                    >
                      <span className={styles.habitToggleKnob} aria-hidden />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>
      ))}
    </div>
  );
}

interface CategoryGroup {
  id: string;
  category: TaskCategory | null;
  weekly: WeeklyTask[];
  monthly: MonthlyTask[];
}

function buildCategoryGroups(
  categories: TaskCategory[],
  weeklyTasks: WeeklyTask[],
  monthlyTasks: MonthlyTask[],
): CategoryGroup[] {
  const byId = new Map<string, CategoryGroup>();

  for (const category of categories) {
    byId.set(category.id, {
      id: category.id,
      category,
      weekly: [],
      monthly: [],
    });
  }

  const uncategorized: CategoryGroup = {
    id: "uncategorized",
    category: null,
    weekly: [],
    monthly: [],
  };

  for (const task of weeklyTasks) {
    const group = task.categoryId ? byId.get(task.categoryId) : uncategorized;
    (group ?? uncategorized).weekly.push(task);
  }

  for (const task of monthlyTasks) {
    const group = task.categoryId ? byId.get(task.categoryId) : uncategorized;
    (group ?? uncategorized).monthly.push(task);
  }

  const groups: CategoryGroup[] = [];
  for (const category of categories) {
    const group = byId.get(category.id);
    if (group && (group.weekly.length > 0 || group.monthly.length > 0)) {
      groups.push(group);
    }
  }

  if (uncategorized.weekly.length > 0 || uncategorized.monthly.length > 0) {
    groups.push(uncategorized);
  }

  return groups;
}
