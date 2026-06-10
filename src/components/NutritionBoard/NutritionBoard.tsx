import { IntakeCard } from "@/components/IntakeCard/IntakeCard";
import { MealsCard } from "@/components/MealsCard/MealsCard";
import type { DailySnacks, MealEntry, MealKey } from "@/lib/habits";
import type { IntakeEntry, IntakeKind } from "@/lib/intake";
import styles from "./NutritionBoard.module.scss";

interface Props {
  date: string;
  showMeals: boolean;
  showSnacks: boolean;
  showIntake: boolean;
  meals: Record<MealKey, MealEntry | null>;
  snacks: DailySnacks;
  intake: Record<IntakeKind, IntakeEntry | null>;
}

export function NutritionBoard({
  date,
  showMeals,
  showSnacks,
  showIntake,
  meals,
  snacks,
  intake,
}: Props) {
  if (!showMeals && !showSnacks && !showIntake) return null;

  return (
    <div className={styles.board}>
      {showMeals || showSnacks ? (
        <MealsCard
          date={date}
          meals={meals}
          snacks={snacks}
          showMeals={showMeals}
          showSnacks={showSnacks}
        />
      ) : null}
      {showIntake ? <IntakeCard date={date} intake={intake} /> : null}
    </div>
  );
}
