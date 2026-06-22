"use client";

import { usePlanSortable } from "./usePlanSortable";

interface Props {
  id: string;
  children: (sortable: ReturnType<typeof usePlanSortable>) => React.ReactNode;
}

export function PlanSortableRow({ id, children }: Props) {
  const sortable = usePlanSortable(id);
  return <>{children(sortable)}</>;
}
