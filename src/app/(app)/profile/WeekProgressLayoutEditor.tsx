"use client";

import { useEffect, useState, useTransition } from "react";
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
import { updateWeekProgressLayoutAction } from "@/app/(app)/actions";
import type { Habit } from "@/lib/habits";
import {
  WEEK_PROGRESS_SECTION_LABEL,
  WEEK_PROGRESS_TRAINING_META,
  habitDailyRowKey,
  parseDailyRowKey,
  type WeekProgressDailyRowKey,
  type WeekProgressLayout,
  type WeekProgressSectionKey,
  type WeekProgressTrainingKey,
} from "@/lib/week-progress-layout";
import styles from "./WeekProgressLayoutEditor.module.scss";

interface Props {
  layout: WeekProgressLayout;
  habits: Habit[];
}

export function WeekProgressLayoutEditor({ layout, habits }: Props) {
  const router = useRouter();
  const [local, setLocal] = useState(layout);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    setLocal(layout);
  }, [layout]);

  const habitByKey = new Map(habits.map((h) => [h.key, h]));

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 180, tolerance: 6 },
    }),
  );

  const save = (next: WeekProgressLayout) => {
    setLocal(next);
    setError(null);
    startTransition(async () => {
      const res = await updateWeekProgressLayoutAction(next);
      if (!res.ok) {
        setError(res.error ?? "Kunde inte spara ordning.");
        setLocal(layout);
        return;
      }
      router.refresh();
    });
  };

  const onDragEnd =
    <K extends string>(key: keyof WeekProgressLayout, items: K[]) =>
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;
      const oldIndex = items.indexOf(active.id as K);
      const newIndex = items.indexOf(over.id as K);
      if (oldIndex < 0 || newIndex < 0) return;
      save({
        ...local,
        [key]: arrayMove(items, oldIndex, newIndex),
      });
    };

  const dailyLabel = (key: WeekProgressDailyRowKey) => {
    const parsed = parseDailyRowKey(key);
    if (parsed.type === "water") {
      return { icon: "💧", label: "Vatten" };
    }
    const habit = habitByKey.get(parsed.habitKey);
    return {
      icon: habit?.icon ?? "•",
      label: habit?.label ?? parsed.habitKey,
    };
  };

  return (
    <div className={styles.editor}>
      <p className={styles.hint}>
        Dra raderna för att styra ordningen i veckovyn under{" "}
        <strong>Hur det går</strong>.
      </p>

      {error ? <p className={styles.error}>{error}</p> : null}

      <LayoutList
        title="Sektioner"
        subtitle="Ordning på blocken i tabellen"
        items={local.sections}
        onDragEnd={onDragEnd("sections", local.sections)}
        renderItem={(key) => ({
          id: key,
          icon: sectionIcon(key),
          label: WEEK_PROGRESS_SECTION_LABEL[key],
        })}
        pending={pending}
        sensors={sensors}
      />

      <LayoutList
        title="Dagligt"
        subtitle="Vatten och dagliga vanor"
        items={local.dailyRows}
        onDragEnd={onDragEnd("dailyRows", local.dailyRows)}
        renderItem={(key) => {
          const meta = dailyLabel(key);
          return { id: key, icon: meta.icon, label: meta.label };
        }}
        pending={pending}
        sensors={sensors}
      />

      <LayoutList
        title="Träning & hälsa"
        subtitle="Gym, cardio, sport och bad"
        items={local.trainingRows}
        onDragEnd={onDragEnd("trainingRows", local.trainingRows)}
        renderItem={(key) => ({
          id: key,
          icon: WEEK_PROGRESS_TRAINING_META[key].icon,
          label: WEEK_PROGRESS_TRAINING_META[key].label,
        })}
        pending={pending}
        sensors={sensors}
      />

      <p className={styles.note}>
        Uppgiftskategorier följer ordningen under{" "}
        <strong>Kategorier</strong> ovan. Nya vanor läggs till sist automatiskt.
      </p>
    </div>
  );
}

function sectionIcon(key: WeekProgressSectionKey): string {
  switch (key) {
    case "daily":
      return "☀️";
    case "training":
      return "💪";
    case "tasks":
      return "📋";
    case "journal":
      return "📓";
  }
}

function LayoutList<T extends string>({
  title,
  subtitle,
  items,
  onDragEnd,
  renderItem,
  pending,
  sensors,
}: {
  title: string;
  subtitle: string;
  items: T[];
  onDragEnd: (event: DragEndEvent) => void;
  renderItem: (key: T) => { id: T; icon: string; label: string };
  pending: boolean;
  sensors: ReturnType<typeof useSensors>;
}) {
  return (
    <section className={styles.listSection}>
      <header className={styles.listHeader}>
        <h4 className={styles.listTitle}>{title}</h4>
        <p className={styles.listSubtitle}>{subtitle}</p>
      </header>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={onDragEnd}
      >
        <SortableContext items={items} strategy={verticalListSortingStrategy}>
          <ul className={styles.list}>
            {items.map((key) => {
              const item = renderItem(key);
              return (
                <SortableLayoutItem
                  key={item.id}
                  id={item.id}
                  icon={item.icon}
                  label={item.label}
                  disabled={pending}
                />
              );
            })}
          </ul>
        </SortableContext>
      </DndContext>
    </section>
  );
}

function SortableLayoutItem({
  id,
  icon,
  label,
  disabled,
}: {
  id: string;
  icon: string;
  label: string;
  disabled?: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, disabled });

  return (
    <li
      ref={setNodeRef}
      className={[styles.item, isDragging ? styles.itemDragging : ""]
        .filter(Boolean)
        .join(" ")}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
    >
      <button
        type="button"
        className={styles.dragHandle}
        aria-label={`Flytta ${label}`}
        {...attributes}
        {...listeners}
      >
        ⠿
      </button>
      <span className={styles.itemIcon} aria-hidden>
        {icon}
      </span>
      <span className={styles.itemLabel}>{label}</span>
    </li>
  );
}
