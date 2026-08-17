"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/Button/Button";
import { Input } from "@/components/Input/Input";
import {
  archiveHabitAction,
  createHabitAction,
  setHabitEnabledAction,
  setHabitShowOnLeaveAction,
  updateHabitAction,
} from "@/app/(app)/actions";
import {
  archiveMonthlyTaskAction,
  archiveWeeklyTaskAction,
  createMonthlyTaskAction,
  createWeeklyTaskAction,
  setMonthlyTaskEnabledAction,
  setWeeklyTaskEnabledAction,
  updateMonthlyTaskAction,
  updateWeeklyTaskAction,
} from "@/app/(app)/tasks-actions";
import {
  isMonthlyTaskCategoryName,
  UTGIFTER_CATEGORY_NAME,
} from "@/lib/expenses";
import { habitCadenceLabel, type Habit } from "@/lib/habits";
import { todayLocalISO } from "@/lib/date";
import {
  WEEKDAY_SHORT,
  WEEKDAYS,
  groupTasksByCategory,
  normalizeWeeklyGoal,
  type MonthlyTask,
  type TaskCategory,
  type Weekday,
  type WeeklyTask,
} from "@/lib/tasks";
import styles from "./task-settings.module.scss";

type Period = "day" | "week" | "month";

const PRESET_ICONS = ["✓", "🏃", "🧺", "🛒", "📞", "📚", "💪", "🎵", "🧹", "🍳", "💸", "🎸", "🥤"];
const PRESET_ACCENTS = [
  "#ff7a1a",
  "#6ee7a3",
  "#ffcf3a",
  "#ff5247",
  "#5fb6ff",
  "#c084fc",
  "#e879f9",
];

interface Props {
  habits: Habit[];
  dailyCategories: TaskCategory[];
  weeklyTasks: WeeklyTask[];
  monthlyTasks: MonthlyTask[];
  taskCategories: TaskCategory[];
}

export function TaskSettingsClient({
  habits,
  dailyCategories,
  weeklyTasks,
  monthlyTasks,
  taskCategories,
}: Props) {
  const [period, setPeriod] = useState<Period>("week");
  const [error, setError] = useState<string | null>(null);

  return (
    <div className={styles.main}>
      <header className={styles.header}>
        <p className={styles.eyebrow}>Task settings</p>
        <h1 className={styles.title}>Uppgiftsinställningar</h1>
        <p className={styles.muted}>
          Hantera dag-, vecko- och månadsuppgifter per kategori. För
          dagliga vanor kan du välja varje dag eller varannan dag. För
          veckouppgifter kan du också välja om de får dras in flera gånger och
          hur många som behövs för godkänd vecka.
        </p>
      </header>

      <div className={styles.tabs} role="tablist" aria-label="Period">
        {(
          [
            ["day", "Dag"],
            ["week", "Vecka"],
            ["month", "Månad"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={period === id}
            className={[styles.tab, period === id ? styles.tabActive : ""]
              .filter(Boolean)
              .join(" ")}
            onClick={() => {
              setError(null);
              setPeriod(id);
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {error ? <p className={styles.error}>{error}</p> : null}

      {period === "day" ? (
        <DaySection
          habits={habits}
          categories={dailyCategories}
          onError={setError}
        />
      ) : null}
      {period === "week" ? (
        <WeekSection
          tasks={weeklyTasks}
          categories={taskCategories}
          onError={setError}
        />
      ) : null}
      {period === "month" ? (
        <MonthSection
          tasks={monthlyTasks}
          categories={taskCategories}
          onError={setError}
        />
      ) : null}
    </div>
  );
}

function DaySection({
  habits,
  categories,
  onError,
}: {
  habits: Habit[];
  categories: TaskCategory[];
  onError: (msg: string | null) => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [label, setLabel] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [icon, setIcon] = useState(PRESET_ICONS[0]);
  const [accent, setAccent] = useState(PRESET_ACCENTS[0]);
  const [intervalDays, setIntervalDays] = useState(1);
  const [intervalAnchorDate, setIntervalAnchorDate] = useState(todayLocalISO());
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  const groups = useMemo(() => {
    return groupTasksByCategory(
      categories,
      habits.map((h) => ({ ...h, categoryId: h.categoryId })),
    );
  }, [habits, categories]);

  const resetAdd = () => {
    setAdding(false);
    setLabel("");
    setCategoryId("");
    setIcon(PRESET_ICONS[0]);
    setAccent(PRESET_ACCENTS[0]);
    setIntervalDays(1);
    setIntervalAnchorDate(todayLocalISO());
  };

  const submitAdd = (e: React.FormEvent) => {
    e.preventDefault();
    onError(null);
    startTransition(async () => {
      const res = await createHabitAction({
        label,
        icon,
        accent,
        categoryId: categoryId || null,
        intervalDays,
        intervalAnchorDate: intervalDays > 1 ? intervalAnchorDate : null,
      });
      if (!res.ok) {
        onError(res.error ?? "Kunde inte skapa vanan.");
        return;
      }
      resetAdd();
      router.refresh();
    });
  };

  return (
    <>
      <div className={styles.sectionHead}>
        <h2 className={styles.sectionTitle}>Dagliga vanor</h2>
        {!adding ? (
          <Button type="button" variant="outline" onClick={() => setAdding(true)}>
            + Ny vana
          </Button>
        ) : null}
      </div>

      {adding ? (
        <form className={styles.addCard} onSubmit={submitAdd}>
          <Input
            label="Namn"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            maxLength={32}
            required
            disabled={pending}
          />
          <CategorySelect
            categories={categories}
            value={categoryId}
            onChange={setCategoryId}
            disabled={pending}
          />
          <IconAccentPickers
            icon={icon}
            accent={accent}
            onIcon={setIcon}
            onAccent={setAccent}
            disabled={pending}
          />
          <HabitCadenceFields
            intervalDays={intervalDays}
            intervalAnchorDate={intervalAnchorDate}
            onIntervalDays={setIntervalDays}
            onAnchorDate={setIntervalAnchorDate}
            disabled={pending}
          />
          <div className={styles.actions}>
            <Button type="submit" loading={pending}>
              Skapa
            </Button>
            <Button type="button" variant="outline" onClick={resetAdd} disabled={pending}>
              Avbryt
            </Button>
          </div>
        </form>
      ) : null}

      {groups.length === 0 ? (
        <p className={styles.empty}>Inga dagliga vanor ännu.</p>
      ) : (
        groups.map((group) => (
          <section key={group.id} className={styles.categoryBlock}>
            <h3 className={styles.categoryLabel}>
              <span className={styles.categoryIcon}>
                {group.category?.icon ?? "•"}
              </span>
              {group.category?.name ?? "Utan kategori"}
            </h3>
            <ul className={styles.list}>
              {group.items.map((habit) => (
                <HabitRow
                  key={habit.id}
                  habit={habit}
                  categories={categories}
                  expanded={expandedId === habit.id}
                  pending={pending}
                  confirming={confirmingId === habit.id}
                  onToggle={() =>
                    setExpandedId(expandedId === habit.id ? null : habit.id)
                  }
                  onConfirming={setConfirmingId}
                  onError={onError}
                  startTransition={startTransition}
                />
              ))}
            </ul>
          </section>
        ))
      )}
    </>
  );
}

function HabitRow({
  habit,
  categories,
  expanded,
  pending,
  confirming,
  onToggle,
  onConfirming,
  onError,
  startTransition,
}: {
  habit: Habit;
  categories: TaskCategory[];
  expanded: boolean;
  pending: boolean;
  confirming: boolean;
  onToggle: () => void;
  onConfirming: (id: string | null) => void;
  onError: (msg: string | null) => void;
  startTransition: (fn: () => void) => void;
}) {
  const router = useRouter();
  const [label, setLabel] = useState(habit.label);
  const [categoryId, setCategoryId] = useState(habit.categoryId ?? "");
  const [icon, setIcon] = useState(habit.icon);
  const [accent, setAccent] = useState(habit.accent);
  const [intervalDays, setIntervalDays] = useState(habit.intervalDays);
  const [intervalAnchorDate, setIntervalAnchorDate] = useState(
    habit.intervalAnchorDate ?? todayLocalISO(),
  );

  const save = () => {
    onError(null);
    startTransition(async () => {
      const res = await updateHabitAction({
        habitId: habit.id,
        label,
        icon,
        accent,
        categoryId: categoryId || null,
        intervalDays,
        intervalAnchorDate: intervalDays > 1 ? intervalAnchorDate : null,
      });
      if (!res.ok) onError(res.error ?? "Kunde inte spara.");
      router.refresh();
    });
  };

  return (
    <li className={[styles.row, habit.enabled ? "" : styles.rowDisabled].filter(Boolean).join(" ")}>
      <button type="button" className={styles.rowHeader} onClick={onToggle}>
        <span className={styles.rowIcon} style={{ color: habit.accent }}>
          {habit.icon}
        </span>
        <span className={styles.rowMeta}>
          <span className={styles.rowTitle}>{habit.label}</span>
          <span className={styles.rowSub}>
            {habit.enabled ? "På" : "Av"}
            {habitCadenceLabel(habit) ? ` · ${habitCadenceLabel(habit)?.toLowerCase()}` : ""}
            {habit.showOnLeave ? " · visas på ledighet" : ""}
          </span>
        </span>
        <span className={styles.chevron} aria-hidden>
          {expanded ? "▴" : "▾"}
        </span>
      </button>
      {expanded ? (
        <div className={styles.editor}>
          <Input
            label="Namn"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            maxLength={32}
            disabled={pending}
          />
          <CategorySelect
            categories={categories}
            value={categoryId}
            onChange={setCategoryId}
            disabled={pending}
          />
          <IconAccentPickers
            icon={icon}
            accent={accent}
            onIcon={setIcon}
            onAccent={setAccent}
            disabled={pending}
          />
          <HabitCadenceFields
            intervalDays={intervalDays}
            intervalAnchorDate={intervalAnchorDate}
            onIntervalDays={setIntervalDays}
            onAnchorDate={setIntervalAnchorDate}
            disabled={pending}
          />
          <div className={styles.toggles}>
            <label className={styles.toggle}>
              <input
                type="checkbox"
                checked={habit.enabled}
                disabled={pending}
                onChange={(e) => {
                  onError(null);
                  startTransition(async () => {
                    const res = await setHabitEnabledAction({
                      habitId: habit.id,
                      enabled: e.target.checked,
                    });
                    if (!res.ok) onError(res.error ?? "Kunde inte uppdatera.");
                    router.refresh();
                  });
                }}
              />
              Aktiv
            </label>
            <label className={styles.toggle}>
              <input
                type="checkbox"
                checked={habit.showOnLeave}
                disabled={pending}
                onChange={(e) => {
                  onError(null);
                  startTransition(async () => {
                    const res = await setHabitShowOnLeaveAction({
                      habitId: habit.id,
                      showOnLeave: e.target.checked,
                    });
                    if (!res.ok) onError(res.error ?? "Kunde inte uppdatera.");
                    router.refresh();
                  });
                }}
              />
              Visa på ledighet
            </label>
          </div>
          <div className={styles.actions}>
            <Button type="button" onClick={save} loading={pending}>
              Spara
            </Button>
            {confirming ? (
              <>
                <Button
                  type="button"
                  variant="danger"
                  disabled={pending}
                  onClick={() => {
                    onError(null);
                    startTransition(async () => {
                      const res = await archiveHabitAction(habit.id);
                      if (!res.ok) {
                        onError(res.error ?? "Kunde inte ta bort.");
                        return;
                      }
                      onConfirming(null);
                      router.refresh();
                    });
                  }}
                >
                  Bekräfta borttagning
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={pending}
                  onClick={() => onConfirming(null)}
                >
                  Avbryt
                </Button>
              </>
            ) : (
              <Button
                type="button"
                variant="outline"
                disabled={pending}
                onClick={() => onConfirming(habit.id)}
              >
                Ta bort
              </Button>
            )}
          </div>
        </div>
      ) : null}
    </li>
  );
}

function WeekSection({
  tasks,
  categories,
  onError,
}: {
  tasks: WeeklyTask[];
  categories: TaskCategory[];
  onError: (msg: string | null) => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [icon, setIcon] = useState(PRESET_ICONS[0]);
  const [accent, setAccent] = useState(PRESET_ACCENTS[0]);
  const [isRepeatable, setIsRepeatable] = useState(false);
  const [weeklyGoal, setWeeklyGoal] = useState("1");
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  const weekCategories = useMemo(
    () => categories.filter((c) => !isMonthlyTaskCategoryName(c.name)),
    [categories],
  );

  const groups = useMemo(
    () => groupTasksByCategory(weekCategories, tasks),
    [weekCategories, tasks],
  );

  const resetAdd = () => {
    setAdding(false);
    setTitle("");
    setNotes("");
    setCategoryId("");
    setIcon(PRESET_ICONS[0]);
    setAccent(PRESET_ACCENTS[0]);
    setIsRepeatable(false);
    setWeeklyGoal("1");
  };

  const submitAdd = (e: React.FormEvent) => {
    e.preventDefault();
    onError(null);
    const goal = Number(weeklyGoal);
    startTransition(async () => {
      const res = await createWeeklyTaskAction({
        title,
        notes,
        categoryId: categoryId || null,
        icon,
        accent,
        isRepeatable,
        weeklyGoal: goal,
      });
      if (!res.ok) {
        onError(res.error ?? "Kunde inte skapa uppgiften.");
        return;
      }
      resetAdd();
      router.refresh();
    });
  };

  return (
    <>
      <div className={styles.sectionHead}>
        <h2 className={styles.sectionTitle}>Veckouppgifter</h2>
        {!adding ? (
          <Button type="button" variant="outline" onClick={() => setAdding(true)}>
            + Ny veckouppgift
          </Button>
        ) : null}
      </div>

      {adding ? (
        <form className={styles.addCard} onSubmit={submitAdd}>
          <Input
            label="Namn"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={80}
            required
            disabled={pending}
          />
          <div className={styles.field}>
            <label className={styles.fieldLabel}>Anteckning</label>
            <textarea
              className={styles.textArea}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={pending}
            />
          </div>
          <CategorySelect
            categories={weekCategories}
            value={categoryId}
            onChange={setCategoryId}
            disabled={pending}
          />
          <IconAccentPickers
            icon={icon}
            accent={accent}
            onIcon={setIcon}
            onAccent={setAccent}
            disabled={pending}
          />
          <label className={styles.toggle}>
            <input
              type="checkbox"
              checked={isRepeatable}
              disabled={pending}
              onChange={(e) => {
                const next = e.target.checked;
                setIsRepeatable(next);
                if (next && Number(weeklyGoal) < 2) setWeeklyGoal("2");
                if (!next) setWeeklyGoal("1");
              }}
            />
            Kan dras in flera gånger per vecka
          </label>
          <div className={styles.field}>
            <label className={styles.fieldLabel} htmlFor="new-weekly-goal">
              Mål per vecka
            </label>
            <input
              id="new-weekly-goal"
              className={styles.numberInput}
              type="number"
              min={1}
              max={14}
              value={weeklyGoal}
              onChange={(e) => setWeeklyGoal(e.target.value)}
              disabled={pending}
            />
          </div>
          <div className={styles.actions}>
            <Button type="submit" loading={pending}>
              Skapa
            </Button>
            <Button type="button" variant="outline" onClick={resetAdd} disabled={pending}>
              Avbryt
            </Button>
          </div>
        </form>
      ) : null}

      {groups.length === 0 ? (
        <p className={styles.empty}>Inga veckouppgifter ännu.</p>
      ) : (
        groups.map((group) => (
          <section key={group.id} className={styles.categoryBlock}>
            <h3 className={styles.categoryLabel}>
              <span className={styles.categoryIcon}>
                {group.category?.icon ?? "•"}
              </span>
              {group.category?.name ?? "Utan kategori"}
            </h3>
            {group.category ? (
              <CategoryGoalSummary tasks={group.items} categoryName={group.category.name} />
            ) : (
              <CategoryGoalSummary tasks={group.items} categoryName="Övrigt" />
            )}
            <ul className={styles.list}>
              {group.items.map((task) => (
                <WeeklyTaskRow
                  key={task.id}
                  task={task}
                  categories={weekCategories}
                  expanded={expandedId === task.id}
                  pending={pending}
                  confirming={confirmingId === task.id}
                  onToggle={() =>
                    setExpandedId(expandedId === task.id ? null : task.id)
                  }
                  onConfirming={setConfirmingId}
                  onError={onError}
                  startTransition={startTransition}
                />
              ))}
            </ul>
          </section>
        ))
      )}
    </>
  );
}

function CategoryGoalSummary({
  tasks,
  categoryName,
}: {
  tasks: WeeklyTask[];
  categoryName: string;
}) {
  const total = tasks.reduce((sum, t) => sum + normalizeWeeklyGoal(t.weeklyGoal), 0);
  return (
    <div className={styles.categoryGoal}>
      <p className={styles.categoryGoalHint}>
        <strong>Kategorimål / vecka: {total}</strong>
        {" — "}
        summan av task-målen i {categoryName} (uppdateras automatiskt).
      </p>
    </div>
  );
}

function WeeklyTaskRow({
  task,
  categories,
  expanded,
  pending,
  confirming,
  onToggle,
  onConfirming,
  onError,
  startTransition,
}: {
  task: WeeklyTask;
  categories: TaskCategory[];
  expanded: boolean;
  pending: boolean;
  confirming: boolean;
  onToggle: () => void;
  onConfirming: (id: string | null) => void;
  onError: (msg: string | null) => void;
  startTransition: (fn: () => void) => void;
}) {
  const router = useRouter();
  const [title, setTitle] = useState(task.title);
  const [notes, setNotes] = useState(task.notes ?? "");
  const [categoryId, setCategoryId] = useState(task.categoryId ?? "");
  const [icon, setIcon] = useState(task.icon);
  const [accent, setAccent] = useState(task.accent);
  const [defaultWeekday, setDefaultWeekday] = useState<string>(
    task.defaultWeekday != null ? String(task.defaultWeekday) : "",
  );
  const [isRepeatable, setIsRepeatable] = useState(task.isRepeatable);
  const [weeklyGoal, setWeeklyGoal] = useState(String(task.weeklyGoal));

  const save = () => {
    onError(null);
    const goal = Number(weeklyGoal);
    startTransition(async () => {
      const res = await updateWeeklyTaskAction({
        id: task.id,
        title,
        notes,
        categoryId: categoryId || null,
        icon,
        accent,
        defaultWeekday: defaultWeekday
          ? (Number(defaultWeekday) as Weekday)
          : null,
        isRepeatable,
        weeklyGoal: goal,
      });
      if (!res.ok) onError(res.error ?? "Kunde inte spara.");
      router.refresh();
    });
  };

  return (
    <li className={[styles.row, task.enabled ? "" : styles.rowDisabled].filter(Boolean).join(" ")}>
      <button type="button" className={styles.rowHeader} onClick={onToggle}>
        <span className={styles.rowIcon} style={{ color: task.accent }}>
          {task.icon}
        </span>
        <span className={styles.rowMeta}>
          <span className={styles.rowTitle}>{task.title}</span>
          <span className={styles.rowSub}>
            {task.enabled ? "På" : "Av"}
            {` · mål ${task.weeklyGoal}/vecka`}
            {task.isRepeatable ? " · repeterbar" : ""}
          </span>
        </span>
        <span className={styles.chevron} aria-hidden>
          {expanded ? "▴" : "▾"}
        </span>
      </button>
      {expanded ? (
        <div className={styles.editor}>
          <Input
            label="Namn"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={80}
            disabled={pending}
          />
          <div className={styles.field}>
            <label className={styles.fieldLabel}>Anteckning</label>
            <textarea
              className={styles.textArea}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={pending}
            />
          </div>
          <CategorySelect
            categories={categories}
            value={categoryId}
            onChange={setCategoryId}
            disabled={pending}
          />
          <IconAccentPickers
            icon={icon}
            accent={accent}
            onIcon={setIcon}
            onAccent={setAccent}
            disabled={pending}
          />
          <div className={styles.field}>
            <label className={styles.fieldLabel} htmlFor={`wd-${task.id}`}>
              Standarddag
            </label>
            <select
              id={`wd-${task.id}`}
              className={styles.select}
              value={defaultWeekday}
              onChange={(e) => setDefaultWeekday(e.target.value)}
              disabled={pending}
            >
              <option value="">Ingen</option>
              {WEEKDAYS.map((d) => (
                <option key={d} value={d}>
                  {WEEKDAY_SHORT[d]}
                </option>
              ))}
            </select>
          </div>
          <div className={styles.toggles}>
            <label className={styles.toggle}>
              <input
                type="checkbox"
                checked={task.enabled}
                disabled={pending}
                onChange={(e) => {
                  onError(null);
                  startTransition(async () => {
                    const res = await setWeeklyTaskEnabledAction({
                      taskId: task.id,
                      enabled: e.target.checked,
                    });
                    if (!res.ok) onError(res.error ?? "Kunde inte uppdatera.");
                    router.refresh();
                  });
                }}
              />
              Aktiv
            </label>
            <label className={styles.toggle}>
              <input
                type="checkbox"
                checked={isRepeatable}
                disabled={pending}
                onChange={(e) => {
                  const next = e.target.checked;
                  setIsRepeatable(next);
                  if (next && Number(weeklyGoal) < 2) setWeeklyGoal("2");
                  if (!next && Number(weeklyGoal) > 1) setWeeklyGoal("1");
                }}
              />
              Kan dras in flera gånger per vecka
            </label>
          </div>
          <div className={styles.field}>
            <label className={styles.fieldLabel} htmlFor={`goal-${task.id}`}>
              Mål per vecka (för godkänd)
            </label>
            <input
              id={`goal-${task.id}`}
              className={styles.numberInput}
              type="number"
              min={1}
              max={14}
              value={weeklyGoal}
              onChange={(e) => setWeeklyGoal(e.target.value)}
              disabled={pending}
            />
          </div>
          <div className={styles.actions}>
            <Button type="button" onClick={save} loading={pending}>
              Spara
            </Button>
            {confirming ? (
              <>
                <Button
                  type="button"
                  variant="danger"
                  disabled={pending}
                  onClick={() => {
                    onError(null);
                    startTransition(async () => {
                      const res = await archiveWeeklyTaskAction(task.id);
                      if (!res.ok) {
                        onError(res.error ?? "Kunde inte ta bort.");
                        return;
                      }
                      onConfirming(null);
                      router.refresh();
                    });
                  }}
                >
                  Bekräfta borttagning
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={pending}
                  onClick={() => onConfirming(null)}
                >
                  Avbryt
                </Button>
              </>
            ) : (
              <Button
                type="button"
                variant="outline"
                disabled={pending}
                onClick={() => onConfirming(task.id)}
              >
                Ta bort
              </Button>
            )}
          </div>
        </div>
      ) : null}
    </li>
  );
}

function MonthSection({
  tasks,
  categories,
  onError,
}: {
  tasks: MonthlyTask[];
  categories: TaskCategory[];
  onError: (msg: string | null) => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [dayOfMonth, setDayOfMonth] = useState("");
  const [icon, setIcon] = useState(PRESET_ICONS[0]);
  const [accent, setAccent] = useState(PRESET_ACCENTS[0]);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  const monthCategories = useMemo(
    () => categories.filter((c) => isMonthlyTaskCategoryName(c.name)),
    [categories],
  );

  const groups = useMemo(
    () => groupTasksByCategory(monthCategories, tasks),
    [monthCategories, tasks],
  );

  const resetAdd = () => {
    setAdding(false);
    setTitle("");
    setNotes("");
    setCategoryId("");
    setDayOfMonth("");
    setIcon(PRESET_ICONS[0]);
    setAccent(PRESET_ACCENTS[0]);
  };

  const submitAdd = (e: React.FormEvent) => {
    e.preventDefault();
    onError(null);
    let dom: number | null = null;
    if (dayOfMonth.trim()) {
      const n = Number(dayOfMonth);
      if (!Number.isFinite(n) || n < 1 || n > 31) {
        onError("Dagen måste vara 1–31, eller lämna tom.");
        return;
      }
      dom = Math.round(n);
    }
    startTransition(async () => {
      const res = await createMonthlyTaskAction({
        title,
        notes,
        categoryId: categoryId || null,
        dayOfMonth: dom,
        icon,
        accent,
      });
      if (!res.ok) {
        onError(res.error ?? "Kunde inte skapa uppgiften.");
        return;
      }
      resetAdd();
      router.refresh();
    });
  };

  return (
    <>
      <div className={styles.sectionHead}>
        <div>
          <h2 className={styles.sectionTitle}>Månadsuppgifter</h2>
          <p className={styles.categoryGoalHint}>
            Ekonomi, Sparande och Räkningar: en gång per månad och task. Utgifter
            är mer sporadiska.
          </p>
        </div>
        {!adding ? (
          <Button type="button" variant="outline" onClick={() => setAdding(true)}>
            + Ny månadsuppgift
          </Button>
        ) : null}
      </div>

      {adding ? (
        <form className={styles.addCard} onSubmit={submitAdd}>
          <Input
            label="Namn"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={80}
            required
            disabled={pending}
          />
          <div className={styles.field}>
            <label className={styles.fieldLabel}>Anteckning</label>
            <textarea
              className={styles.textArea}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={pending}
            />
          </div>
          <CategorySelect
            categories={monthCategories}
            value={categoryId}
            onChange={setCategoryId}
            disabled={pending}
          />
          <Input
            label="Dag i månaden (valfritt)"
            value={dayOfMonth}
            onChange={(e) => setDayOfMonth(e.target.value)}
            inputMode="numeric"
            placeholder="1–31"
            disabled={pending}
          />
          <IconAccentPickers
            icon={icon}
            accent={accent}
            onIcon={setIcon}
            onAccent={setAccent}
            disabled={pending}
          />
          <div className={styles.actions}>
            <Button type="submit" loading={pending}>
              Skapa
            </Button>
            <Button type="button" variant="outline" onClick={resetAdd} disabled={pending}>
              Avbryt
            </Button>
          </div>
        </form>
      ) : null}

      {monthCategories.length === 0 ? (
        <p className={styles.empty}>Inga månadskategorier ännu.</p>
      ) : (
        monthCategories.map((category) => {
          const group = groups.find((g) => g.category?.id === category.id);
          const items = group?.items ?? [];
          const hint =
            category.name === UTGIFTER_CATEGORY_NAME
              ? "Sporadiska utgifter under månaden."
              : "En gång per månad och task.";
          return (
            <section key={category.id} className={styles.categoryBlock}>
              <h3 className={styles.categoryLabel}>
                <span className={styles.categoryIcon}>{category.icon}</span>
                {category.name}
              </h3>
              <p className={styles.categoryGoalHint}>{hint}</p>
              {items.length === 0 ? (
                <p className={styles.empty}>Inga uppgifter i kategorin.</p>
              ) : (
                <ul className={styles.list}>
                  {items.map((task) => (
                    <MonthlyTaskRow
                      key={task.id}
                      task={task}
                      categories={monthCategories}
                      expanded={expandedId === task.id}
                      pending={pending}
                      confirming={confirmingId === task.id}
                      onToggle={() =>
                        setExpandedId(expandedId === task.id ? null : task.id)
                      }
                      onConfirming={setConfirmingId}
                      onError={onError}
                      startTransition={startTransition}
                    />
                  ))}
                </ul>
              )}
            </section>
          );
        })
      )}
    </>
  );
}

function MonthlyTaskRow({
  task,
  categories,
  expanded,
  pending,
  confirming,
  onToggle,
  onConfirming,
  onError,
  startTransition,
}: {
  task: MonthlyTask;
  categories: TaskCategory[];
  expanded: boolean;
  pending: boolean;
  confirming: boolean;
  onToggle: () => void;
  onConfirming: (id: string | null) => void;
  onError: (msg: string | null) => void;
  startTransition: (fn: () => void) => void;
}) {
  const router = useRouter();
  const [title, setTitle] = useState(task.title);
  const [notes, setNotes] = useState(task.notes ?? "");
  const [categoryId, setCategoryId] = useState(task.categoryId ?? "");
  const [dayOfMonth, setDayOfMonth] = useState(
    task.dayOfMonth != null ? String(task.dayOfMonth) : "",
  );
  const [icon, setIcon] = useState(task.icon);
  const [accent, setAccent] = useState(task.accent);
  const [defaultAmount, setDefaultAmount] = useState(
    task.defaultAmountKr != null ? String(task.defaultAmountKr) : "",
  );

  const save = () => {
    onError(null);
    let dom: number | null = null;
    if (dayOfMonth.trim()) {
      const n = Number(dayOfMonth);
      if (!Number.isFinite(n) || n < 1 || n > 31) {
        onError("Dagen måste vara 1–31, eller lämna tom.");
        return;
      }
      dom = Math.round(n);
    }
    let amount: number | null = null;
    if (defaultAmount.trim()) {
      const n = Number(defaultAmount.replace(",", "."));
      if (!Number.isFinite(n) || n < 0) {
        onError("Ogiltigt belopp.");
        return;
      }
      amount = n;
    }
    startTransition(async () => {
      const res = await updateMonthlyTaskAction({
        id: task.id,
        title,
        notes,
        categoryId: categoryId || null,
        dayOfMonth: dom,
        icon,
        accent,
        defaultAmountKr: amount,
      });
      if (!res.ok) onError(res.error ?? "Kunde inte spara.");
      router.refresh();
    });
  };

  return (
    <li className={[styles.row, task.enabled ? "" : styles.rowDisabled].filter(Boolean).join(" ")}>
      <button type="button" className={styles.rowHeader} onClick={onToggle}>
        <span className={styles.rowIcon} style={{ color: task.accent }}>
          {task.icon}
        </span>
        <span className={styles.rowMeta}>
          <span className={styles.rowTitle}>{task.title}</span>
          <span className={styles.rowSub}>
            {task.enabled ? "På" : "Av"}
            {task.dayOfMonth != null ? ` · dag ${task.dayOfMonth}` : ""}
          </span>
        </span>
        <span className={styles.chevron} aria-hidden>
          {expanded ? "▴" : "▾"}
        </span>
      </button>
      {expanded ? (
        <div className={styles.editor}>
          <Input
            label="Namn"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={80}
            disabled={pending}
          />
          <div className={styles.field}>
            <label className={styles.fieldLabel}>Anteckning</label>
            <textarea
              className={styles.textArea}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={pending}
            />
          </div>
          <CategorySelect
            categories={categories}
            value={categoryId}
            onChange={setCategoryId}
            disabled={pending}
          />
          <Input
            label="Dag i månaden"
            value={dayOfMonth}
            onChange={(e) => setDayOfMonth(e.target.value)}
            inputMode="numeric"
            placeholder="1–31"
            disabled={pending}
          />
          <Input
            label="Standardbelopp (kr)"
            value={defaultAmount}
            onChange={(e) => setDefaultAmount(e.target.value)}
            inputMode="decimal"
            disabled={pending}
          />
          <IconAccentPickers
            icon={icon}
            accent={accent}
            onIcon={setIcon}
            onAccent={setAccent}
            disabled={pending}
          />
          <label className={styles.toggle}>
            <input
              type="checkbox"
              checked={task.enabled}
              disabled={pending}
              onChange={(e) => {
                onError(null);
                startTransition(async () => {
                  const res = await setMonthlyTaskEnabledAction({
                    taskId: task.id,
                    enabled: e.target.checked,
                  });
                  if (!res.ok) onError(res.error ?? "Kunde inte uppdatera.");
                  router.refresh();
                });
              }}
            />
            Aktiv
          </label>
          <div className={styles.actions}>
            <Button type="button" onClick={save} loading={pending}>
              Spara
            </Button>
            {confirming ? (
              <>
                <Button
                  type="button"
                  variant="danger"
                  disabled={pending}
                  onClick={() => {
                    onError(null);
                    startTransition(async () => {
                      const res = await archiveMonthlyTaskAction(task.id);
                      if (!res.ok) {
                        onError(res.error ?? "Kunde inte ta bort.");
                        return;
                      }
                      onConfirming(null);
                      router.refresh();
                    });
                  }}
                >
                  Bekräfta borttagning
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={pending}
                  onClick={() => onConfirming(null)}
                >
                  Avbryt
                </Button>
              </>
            ) : (
              <Button
                type="button"
                variant="outline"
                disabled={pending}
                onClick={() => onConfirming(task.id)}
              >
                Ta bort
              </Button>
            )}
          </div>
        </div>
      ) : null}
    </li>
  );
}

function HabitCadenceFields({
  intervalDays,
  intervalAnchorDate,
  onIntervalDays,
  onAnchorDate,
  disabled,
}: {
  intervalDays: number;
  intervalAnchorDate: string;
  onIntervalDays: (value: number) => void;
  onAnchorDate: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <>
      <div className={styles.field}>
        <label className={styles.fieldLabel}>
          Återkomst
        </label>
        <select
          className={styles.select}
          value={intervalDays}
          disabled={disabled}
          onChange={(e) => {
            const next = Number(e.target.value);
            onIntervalDays(next);
            if (next > 1 && !intervalAnchorDate) {
              onAnchorDate(todayLocalISO());
            }
          }}
        >
          <option value={1}>Varje dag</option>
          <option value={2}>Varannan dag</option>
        </select>
      </div>
      {intervalDays > 1 ? (
        <Input
          label="Startar"
          type="date"
          value={intervalAnchorDate}
          onChange={(e) => onAnchorDate(e.target.value)}
          disabled={disabled}
          required
          hint="Visas den dagen och sedan varannan dag. Byt datum om du vill skifta cykeln."
        />
      ) : null}
    </>
  );
}

function CategorySelect({
  categories,
  value,
  onChange,
  disabled,
}: {
  categories: TaskCategory[];
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className={styles.field}>
      <label className={styles.fieldLabel}>Kategori</label>
      <select
        className={styles.select}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
      >
        <option value="">— Ingen kategori —</option>
        {categories.map((c) => (
          <option key={c.id} value={c.id}>
            {c.icon} {c.name}
          </option>
        ))}
      </select>
    </div>
  );
}

function IconAccentPickers({
  icon,
  accent,
  onIcon,
  onAccent,
  disabled,
}: {
  icon: string;
  accent: string;
  onIcon: (value: string) => void;
  onAccent: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <>
      <div className={styles.field}>
        <span className={styles.fieldLabel}>Ikon</span>
        <div className={styles.presets}>
          {PRESET_ICONS.map((preset) => (
            <button
              key={preset}
              type="button"
              className={[
                styles.preset,
                icon === preset ? styles.presetActive : "",
              ]
                .filter(Boolean)
                .join(" ")}
              onClick={() => onIcon(preset)}
              disabled={disabled}
              aria-label={`Ikon ${preset}`}
            >
              {preset}
            </button>
          ))}
        </div>
      </div>
      <div className={styles.field}>
        <span className={styles.fieldLabel}>Färg</span>
        <div className={styles.presets}>
          {PRESET_ACCENTS.map((preset) => (
            <button
              key={preset}
              type="button"
              className={[
                styles.preset,
                accent === preset ? styles.presetActive : "",
              ]
                .filter(Boolean)
                .join(" ")}
              onClick={() => onAccent(preset)}
              disabled={disabled}
              aria-label={`Färg ${preset}`}
            >
              <span className={styles.swatch} style={{ background: preset }} />
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
