import { ProgressPlanTabs } from "@/components/ProgressPlanTabs/ProgressPlanTabs";
import type { PeriodView } from "@/lib/period-view";

export type WeekView = PeriodView;

interface Props {
  weekStart: string;
  view: WeekView;
}

export function weekNavHref(weekStart: string, view: WeekView): string {
  return `/week?start=${weekStart}&view=${view}`;
}

export function WeekViewTabs({ weekStart, view }: Props) {
  return (
    <ProgressPlanTabs
      view={view}
      progressHref={weekNavHref(weekStart, "progress")}
      planHref={weekNavHref(weekStart, "plan")}
    />
  );
}
