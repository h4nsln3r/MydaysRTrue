"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  DndContext,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  reorderHabitsAction,
  setHabitEnabledAction,
  updateDailyTrackerGoalsAction,
} from "@/app/(app)/actions";
import { AddTaskPanel } from "@/components/AddTaskPanel/AddTaskPanel";
import { Input } from "@/components/Input/Input";
import { formatInteger } from "@/lib/format";
import type { Habit, HabitKind } from "@/lib/habits";
import type { DailyTrackerGoals } from "@/lib/habits.server";
import type { TaskCategory } from "@/lib/tasks";
import styles from "./DayPlanPanel.module.scss";

const KIND_HINT: Partial<Record<HabitKind, string>> = {
  water: "Vecka/månad — vattenkortet visas alltid",
  meal: "Frukost, lunch, middag",
  snack: "2 mellanmål — loggas i Måltider",
  intake: "Frukt, kreatin, vitaminer, shake",
  steps: "Antal steg per dag",
  activity_hours: "Aktiva timmar per dag",
  media: "Välj titel i dagsvyn — lägg till i månaden",
  mobile_games: "Chess, Duolingo, Pokemon GO",
  tri_state: "Ja / halv / nej",
};

const GOAL_KINDS = new Set<HabitKind>(["water", "steps", "activity_hours"]);

interface Props {
  habits: Habit[];
  goals: DailyTrackerGoals;
  categories: TaskCategory[];
}

export function DayPlanPanel({ habits, goals, categories }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [localHabits, setLocalHabits] = useState(habits);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLocalHabits(habits);
  }, [habits]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 180, tolerance: 6 },
    }),
  );

  const toggle = (habitId: string, enabled: boolean) => {
    setError(null);
    startTransition(async () => {
      const res = await setHabitEnabledAction({ habitId, enabled: !enabled });
      if (!res.ok) setError(res.error ?? "Kunde inte uppdatera.");
      router.refresh();
    });
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = localHabits.findIndex((h) => h.id === active.id);
    const newIndex = localHabits.findIndex((h) => h.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;

    const next = arrayMove(localHabits, oldIndex, newIndex);
    setLocalHabits(next);
    setError(null);

    startTransition(async () => {
      const res = await reorderHabitsAction(next.map((h) => h.id));
      if (!res.ok) {
        setError(res.error ?? "Kunde inte spara ordning.");
        setLocalHabits(habits);
        return;
      }
      router.refresh();
    });
  };

  return (
    <div className={styles.panel}>
      <section className={styles.section}>
        <header className={styles.sectionHeader}>
          <h2 className={styles.h2}>Dagliga spårare</h2>
          <p className={styles.sub}>
            Dra för ordning · slå på/av det du vill följa
          </p>
        </header>

        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={localHabits.map((h) => h.id)}
            strategy={verticalListSortingStrategy}
          >
            <ul className={styles.trackerList}>
              {localHabits.map((h) => (
                <SortableTrackerRow
                  key={h.id}
                  habit={h}
                  goals={goals}
                  pending={pending}
                  onToggle={toggle}
                  onGoalError={setError}
                />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      </section>

      {error ? <p className={styles.error}>{error}</p> : null}

      <AddTaskPanel categories={categories} defaultScope="daily" />
    </div>
  );
}

interface SortableTrackerRowProps {
  habit: Habit;
  goals: DailyTrackerGoals;
  pending: boolean;
  onToggle: (habitId: string, enabled: boolean) => void;
  onGoalError: (message: string | null) => void;
}

function SortableTrackerRow({
  habit,
  goals,
  pending,
  onToggle,
  onGoalError,
}: SortableTrackerRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: habit.id, disabled: pending });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const hasGoal = GOAL_KINDS.has(habit.kind);

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={[
        styles.trackerItem,
        isDragging ? styles.trackerItemDragging : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div
        className={[
          styles.trackerRow,
          hasGoal ? styles.trackerRowWithGoal : "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        <button
          type="button"
          className={styles.dragHandle}
          aria-label={`Dra ${habit.label}`}
          disabled={pending}
          {...attributes}
          {...listeners}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
            <circle cx="9" cy="7" r="1.5" fill="currentColor" />
            <circle cx="15" cy="7" r="1.5" fill="currentColor" />
            <circle cx="9" cy="12" r="1.5" fill="currentColor" />
            <circle cx="15" cy="12" r="1.5" fill="currentColor" />
            <circle cx="9" cy="17" r="1.5" fill="currentColor" />
            <circle cx="15" cy="17" r="1.5" fill="currentColor" />
          </svg>
        </button>
        <span
          className={styles.trackerIcon}
          aria-hidden
          style={{ borderColor: habit.accent }}
        >
          {habit.icon}
        </span>
        <div className={styles.trackerMeta}>
          <span className={styles.trackerLabel}>{habit.label}</span>
          <span className={styles.trackerHint}>
            {KIND_HINT[habit.kind] ?? "Daglig uppföljning"}
          </span>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={habit.enabled}
          aria-label={`${habit.enabled ? "Stäng av" : "Slå på"} ${habit.label}`}
          className={[
            styles.toggle,
            habit.enabled ? styles.toggleOn : "",
          ]
            .filter(Boolean)
            .join(" ")}
          onClick={() => onToggle(habit.id, habit.enabled)}
          disabled={pending}
        >
          <span className={styles.toggleKnob} aria-hidden />
        </button>
      </div>

      {hasGoal ? (
        <TrackerGoalAccordion
          kind={habit.kind}
          goals={goals}
          pending={pending}
          onError={onGoalError}
        />
      ) : null}
    </li>
  );
}

interface TrackerGoalAccordionProps {
  kind: HabitKind;
  goals: DailyTrackerGoals;
  pending: boolean;
  onError: (message: string | null) => void;
}

function TrackerGoalAccordion({
  kind,
  goals,
  pending,
  onError,
}: TrackerGoalAccordionProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, startTransition] = useTransition();

  const config =
    kind === "water"
      ? {
          label: "Vattenmål",
          suffix: "ml",
          saved: goals.waterGoalMl,
          min: 250,
          max: 20000,
          step: 50,
          inputMode: "numeric" as const,
          placeholder: "3000",
        }
      : kind === "steps"
        ? {
            label: "Stegmål",
            suffix: "steg",
            saved: goals.stepsGoal,
            min: 100,
            max: 100000,
            step: 500,
            inputMode: "numeric" as const,
            placeholder: "8000",
          }
        : kind === "activity_hours"
          ? {
              label: "Aktivitetstimmar",
              suffix: "tim",
              saved: goals.activityHoursGoal,
              min: 0,
              max: 24,
              step: 0.5,
              inputMode: "decimal" as const,
              placeholder: "12",
            }
          : null;

  const [value, setValue] = useState(config?.saved ?? 0);
  const savedRef = useRef(config?.saved ?? 0);

  useEffect(() => {
    if (!config) return;
    savedRef.current = config.saved;
    setValue(config.saved);
  }, [config?.saved, kind]);

  if (!config) return null;

  const summary = `${formatInteger(config.saved)} ${config.suffix}`;

  const save = () => {
    const next = Number(value);
    if (!Number.isFinite(next) || next === savedRef.current) return;

    onError(null);
    startTransition(async () => {
      const payload =
        kind === "water"
          ? { waterGoalMl: next }
          : kind === "steps"
            ? { stepsGoal: next }
            : { activityHoursGoal: next };

      const res = await updateDailyTrackerGoalsAction(payload);
      if (!res.ok) {
        onError(res.error ?? "Kunde inte spara mål.");
        setValue(savedRef.current);
        return;
      }
      router.refresh();
    });
  };

  return (
    <div className={styles.goalAccordion}>
      <button
        type="button"
        className={styles.goalTrigger}
        aria-expanded={open}
        aria-controls={`goal-${kind}`}
        onClick={() => setOpen((prev) => !prev)}
      >
        <span className={styles.goalTriggerLabel}>Mål</span>
        <span className={styles.goalTriggerValue}>{summary}</span>
        <svg
          className={[styles.goalChevron, open ? styles.goalChevronOpen : ""]
            .filter(Boolean)
            .join(" ")}
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden
        >
          <path
            d="m6 9 6 6 6-6"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      <div
        id={`goal-${kind}`}
        className={[styles.goalPanel, open ? styles.goalPanelOpen : ""]
          .filter(Boolean)
          .join(" ")}
        hidden={!open}
      >
        <Input
          label={config.label}
          type="number"
          min={config.min}
          max={config.max}
          step={config.step}
          value={value}
          onChange={(e) => setValue(Number(e.target.value || 0))}
          onBlur={save}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
          }}
          suffix={config.suffix}
          inputMode={config.inputMode}
          placeholder={config.placeholder}
          disabled={pending || saving}
        />
      </div>
    </div>
  );
}
