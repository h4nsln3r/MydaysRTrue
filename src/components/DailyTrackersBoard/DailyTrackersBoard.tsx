import { DailyActivityCard } from "@/components/DailyActivityCard/DailyActivityCard";
import { MealsCard } from "@/components/MealsCard/MealsCard";
import { SnacksCard } from "@/components/SnacksCard/SnacksCard";
import { TriStateHabitRow } from "@/components/TriStateHabitRow/TriStateHabitRow";
import { WaterHeroCard } from "@/components/WaterHeroCard/WaterHeroCard";
import type { DailyActivityLog, DailyTrackerGoals } from "@/lib/habits.server";
import type { DailyHabit, DailySnacks, MealEntry, MealKey } from "@/lib/habits";
import type { WaterSummary } from "@/lib/water";
import styles from "./DailyTrackersBoard.module.scss";

interface Props {
  date: string;
  /** Enabled habits in sort_order. */
  habits: DailyHabit[];
  summary: WaterSummary;
  meals: Record<MealKey, MealEntry | null>;
  snacks: DailySnacks;
  activityLog: DailyActivityLog;
  goals: DailyTrackerGoals;
  waterPlusHref?: string;
  waterPlusLabel?: string;
}

export function DailyTrackersBoard({
  date,
  habits,
  summary,
  meals,
  snacks,
  activityLog,
  goals,
  waterPlusHref,
  waterPlusLabel,
}: Props) {
  if (habits.length === 0) {
    return (
      <p className={styles.empty}>
        Inga spårare aktiva. Slå på några under Planera.
      </p>
    );
  }

  return (
    <div className={styles.stack}>
      {habits.map((habit) => {
        switch (habit.kind) {
          case "water":
            return (
              <WaterHeroCard
                key={habit.id}
                summary={summary}
                plusHref={waterPlusHref}
                plusLabel={waterPlusLabel}
              />
            );
          case "meal":
            return <MealsCard key={habit.id} date={date} meals={meals} />;
          case "snack":
            return <SnacksCard key={habit.id} date={date} snacks={snacks} />;
          case "steps":
            return (
              <DailyActivityCard
                key={habit.id}
                date={date}
                steps={activityLog.steps}
                stepsGoal={goals.stepsGoal}
                activityHours={activityLog.activityHours}
                activityHoursGoal={goals.activityHoursGoal}
                showSteps
                showActivity={false}
                compact
              />
            );
          case "activity_hours":
            return (
              <DailyActivityCard
                key={habit.id}
                date={date}
                steps={activityLog.steps}
                stepsGoal={goals.stepsGoal}
                activityHours={activityLog.activityHours}
                activityHoursGoal={goals.activityHoursGoal}
                showSteps={false}
                showActivity
                compact
              />
            );
          case "tri_state":
            return (
              <TriStateHabitRow key={habit.id} date={date} habit={habit} />
            );
          default:
            return null;
        }
      })}
    </div>
  );
}
