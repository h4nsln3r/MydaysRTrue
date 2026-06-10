import { DailyActivityCard } from "@/components/DailyActivityCard/DailyActivityCard";
import { NutritionBoard } from "@/components/NutritionBoard/NutritionBoard";
import { TriStateHabitRow } from "@/components/TriStateHabitRow/TriStateHabitRow";
import { WaterHeroCard } from "@/components/WaterHeroCard/WaterHeroCard";
import type { DailyActivityLog, DailyTrackerGoals } from "@/lib/habits.server";
import type { DailyHabit, DailySnacks, HabitKind, MealEntry, MealKey } from "@/lib/habits";
import type { IntakeEntry, IntakeKind } from "@/lib/intake";
import type { WaterSummary } from "@/lib/water";
import styles from "./DailyTrackersBoard.module.scss";

const NUTRITION_KINDS = new Set<HabitKind>(["meal", "snack", "intake"]);

interface Props {
  date: string;
  /** Enabled habits in sort_order. */
  habits: DailyHabit[];
  summary: WaterSummary;
  meals: Record<MealKey, MealEntry | null>;
  snacks: DailySnacks;
  intake: Record<IntakeKind, IntakeEntry | null>;
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
  intake,
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

  const showMeals = habits.some((h) => h.kind === "meal");
  const showSnacks = habits.some((h) => h.kind === "snack");
  const showIntake = habits.some((h) => h.kind === "intake");
  let nutritionRendered = false;

  return (
    <div className={styles.stack}>
      {habits.map((habit) => {
        if (NUTRITION_KINDS.has(habit.kind)) {
          if (nutritionRendered) return null;
          nutritionRendered = true;
          return (
            <NutritionBoard
              key="nutrition"
              date={date}
              showMeals={showMeals}
              showSnacks={showSnacks}
              showIntake={showIntake}
              meals={meals}
              snacks={snacks}
              intake={intake}
            />
          );
        }

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
