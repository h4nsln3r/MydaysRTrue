import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { WaterHeroCard } from "@/components/WaterHeroCard/WaterHeroCard";
import { HabitChecks } from "@/components/HabitChecks/HabitChecks";
import { MealsCard } from "@/components/MealsCard/MealsCard";
import { IntakeCard } from "@/components/IntakeCard/IntakeCard";
import { getDailySummary } from "@/lib/water.server";
import { getDailyHabits, getDailyMeals } from "@/lib/habits.server";
import { getDailyIntake } from "@/lib/intake.server";
import { getCategories } from "@/lib/tasks.server";
import { formatDateLong, todayLocalISO } from "@/lib/date";
import styles from "./dashboard.module.scss";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const today = todayLocalISO();
  const [summary, habits, meals, intake, dailyCategories] = await Promise.all([
    getDailySummary(user.id, today),
    getDailyHabits(user.id, today),
    getDailyMeals(user.id, today),
    getDailyIntake(user.id, today),
    getCategories(user.id, "daily"),
  ]);

  // Hide the dedicated meals card if the user archived the meals habit.
  const mealsHabitActive = habits.some((h) => h.kind === "meal");

  return (
    <main className={styles.main}>
      <header className={styles.header}>
        <div>
          <p className={styles.date}>{formatDateLong()}</p>
          <h1 className={styles.h1}>
            Stay <span className={styles.accent}>hydrated</span>
          </h1>
        </div>
        <Link
          href="/add-water"
          className={styles.iconBadge}
          aria-label="Manual water entry"
          title="Manual log"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path
              d="M4 20h4l10-10-4-4L4 16v4Z"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinejoin="round"
            />
            <path
              d="m13.5 6.5 4 4"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        </Link>
      </header>

      <section className={styles.section} aria-labelledby="intake-heading">
        <header className={styles.sectionHeader}>
          <h2 id="intake-heading" className={styles.h2}>
            Intake
          </h2>
          <span className={styles.muted}>food & water</span>
        </header>
        <div className={styles.stack}>
          <WaterHeroCard
            summary={summary}
            plusHref="/water"
            plusLabel="Open water page"
          />
          {mealsHabitActive ? <MealsCard date={today} meals={meals} /> : null}
          <IntakeCard date={today} intake={intake} />
        </div>
      </section>

      <section className={styles.section}>
        <header className={styles.sectionHeader}>
          <h2 className={styles.h2}>Daily habits</h2>
          <Link href="/profile" className={styles.muted}>
            Edit
          </Link>
        </header>
        <HabitChecks
          date={today}
          habits={habits}
          categories={dailyCategories}
        />
      </section>
    </main>
  );
}
