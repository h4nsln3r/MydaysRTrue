"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import dragStyles from "@/components/WeeklyTasksDayCard/WeeklyTasksDayCard.module.scss";

export function usePlanSortable(id: string) {
  const sortable = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(sortable.transform),
    transition: sortable.transition,
    opacity: sortable.isDragging ? 0.65 : 1,
  };

  const dragHandle = (
    <button
      type="button"
      className={dragStyles.dragHandle}
      aria-label="Dra för att ändra ordning"
      {...sortable.attributes}
      {...sortable.listeners}
    >
      ⠿
    </button>
  );

  return {
    sortableRef: sortable.setNodeRef,
    sortableStyle: style,
    dragHandle,
  };
}

export interface PlanSortableProps {
  dragHandle?: React.ReactNode;
  sortableRef?: (node: HTMLElement | null) => void;
  sortableStyle?: React.CSSProperties;
}
