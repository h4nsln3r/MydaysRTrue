import { DailyActivityCard } from "@/components/DailyActivityCard/DailyActivityCard";
import { MobileGamesDayCard } from "@/components/MobileGamesDayCard/MobileGamesDayCard";
import { MoodDayCard } from "@/components/MoodDayCard/MoodDayCard";
import { NutritionBoard } from "@/components/NutritionBoard/NutritionBoard";
import { SmokeFreeDayCard } from "@/components/SmokeFreeDayCard/SmokeFreeDayCard";
import { TriStateHabitRow } from "@/components/TriStateHabitRow/TriStateHabitRow";
import { WaterHeroCard } from "@/components/WaterHeroCard/WaterHeroCard";
import type { DailyActivityLog, DailyTrackerGoals } from "@/lib/habits.server";
import { DAY_PLAN_HABIT_KINDS, isDayPlanOnlyHabit } from "@/lib/day-plan";
import {
  sortOtherDailyTrackersIncompleteFirst,
  habitVisibleOnLeaveDay,
  type DailyHabit,
  type DailySnacks,
  type HabitKind,
  type MealBoxStockItem,
  type MealEntry,
  type MealKey,
  type MealRestaurant,
} from "@/lib/habits";
import type { IntakeEntry, IntakeKind } from "@/lib/intake";
import type { DailyMobileGamesContext } from "@/lib/mobile-games";
import type { DailyMoodContext } from "@/lib/mood";
import type { DailySmokeFreeContext } from "@/lib/smoke-free";
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
  savedRestaurants?: MealRestaurant[];
  mealBoxStock?: MealBoxStockItem[];
  intake: Record<IntakeKind, IntakeEntry | null>;
  activityLog: DailyActivityLog;
  goals: DailyTrackerGoals;
  mobileGames: DailyMobileGamesContext;
  mood: DailyMoodContext;
  smokeFree: DailySmokeFreeContext;
  /** When true, habits with showOnLeave=false are hidden. */
  onLeave?: boolean;
  waterPlusHref?: string;
  waterPlusLabel?: string;
}

export function DailyTrackersBoard({
  date,
  habits,
  summary,
  meals,
  snacks,
  savedRestaurants = [],
  mealBoxStock = [],
  intake,
  activityLog,
  goals,
  mobileGames,
  mood,
  smokeFree,
  onLeave = false,
  waterPlusHref,
  waterPlusLabel,
}: Props) {
  const dayHabits = habits.filter((h) => habitVisibleOnLeaveDay(h, onLeave));

  if (dayHabits.length === 0) {
    return (
      <p className={styles.empty}>
        {onLeave
          ? "Inga spårare visas under ledighet. Justera under Planera."
          : "Inga spårare aktiva. Slå på några under Planera."}
      </p>
    );
  }

  const boardHabits = dayHabits.filter(
    (h) => !DAY_PLAN_HABIT_KINDS.has(h.kind) && !isDayPlanOnlyHabit(h),
  );

  if (boardHabits.length === 0) {
    return (
      <p className={styles.empty}>
        Övriga spårare (vatten m.m.) visas här när de är aktiva.
      </p>
    );
  }

  const showMeals = boardHabits.some((h) => h.kind === "meal");
  const showSnacks = boardHabits.some((h) => h.kind === "snack");
  const showIntake = boardHabits.some((h) => h.kind === "intake");
  const showNutrition = showMeals || showSnacks || showIntake;
  const waterHabit = boardHabits.find((h) => h.kind === "water");
  const activityHabits = sortOtherDailyTrackersIncompleteFirst(
    boardHabits.filter((h) => h.kind !== "water" && !NUTRITION_KINDS.has(h.kind)),
  );

  const renderTracker = (habit: DailyHabit) => {
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
      case "smoke_free":
        return (
          <SmokeFreeDayCard
            key={habit.id}
            date={date}
            habit={habit}
            smokeFree={smokeFree}
          />
        );
      case "mobile_games":
        return (
          <MobileGamesDayCard
            key={habit.id}
            date={date}
            habit={habit}
            games={mobileGames}
          />
        );
      case "mood":
        return (
          <MoodDayCard
            key={habit.id}
            date={date}
            habit={habit}
            mood={mood}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className={styles.stack}>
      {waterHabit ? renderTracker(waterHabit) : null}
      {showNutrition ? (
        <NutritionBoard
          key="nutrition"
          date={date}
          showMeals={showMeals}
          showSnacks={showSnacks}
          showIntake={showIntake}
          meals={meals}
          snacks={snacks}
          savedRestaurants={savedRestaurants}
          mealBoxStock={mealBoxStock}
          intake={intake}
        />
      ) : null}
      {activityHabits.map(renderTracker)}
    </div>
  );
}
