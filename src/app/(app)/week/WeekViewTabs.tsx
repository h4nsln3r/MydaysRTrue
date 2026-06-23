import { ProgressPlanTabs } from "@/components/ProgressPlanTabs/ProgressPlanTabs";
import { weekNavHref } from "@/lib/week-nav";
import type { PeriodView } from "@/lib/period-view";

export type WeekView = PeriodView;

interface Props {
  weekStart: string;
  view: WeekView;
}

export { weekNavHref };

export function WeekViewTabs({ weekStart, view }: Props) {
  return (
    <ProgressPlanTabs
      view={view}
      progressHref={weekNavHref(weekStart, "progress")}
      planHref={weekNavHref(weekStart, "plan")}
    />
  );
}
