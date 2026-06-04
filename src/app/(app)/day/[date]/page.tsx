import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Card } from "@/components/Card/Card";
import { Button } from "@/components/Button/Button";
import { WaterLogItem } from "@/components/WaterLogItem/WaterLogItem";
import { WaterHeroCard } from "@/components/WaterHeroCard/WaterHeroCard";
import { HabitChecks } from "@/components/HabitChecks/HabitChecks";
import { MealsCard } from "@/components/MealsCard/MealsCard";
import { IntakeCard } from "@/components/IntakeCard/IntakeCard";
import { createClient } from "@/lib/supabase/server";
import { getDailySummary } from "@/lib/water.server";
import { getDailyHabits, getDailyMeals } from "@/lib/habits.server";
import { getDailyIntake } from "@/lib/intake.server";
import { getCategories } from "@/lib/tasks.server";
import {
  addDaysISO,
  formatDayLong,
  parseLocalISO,
  todayLocalISO,
  weekStartISO,
} from "@/lib/date";
import styles from "../../dashboard.module.scss";

export const dynamic = "force-dynamic";

interface DayPageProps {
  params: Promise<{ date: string }>;
}

export default async function DayPage({ params }: DayPageProps) {
  const { date } = await params;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) notFound();

  const today = todayLocalISO();
  if (date === today) redirect("/");
  if (date > today) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [summary, habits, meals, intake, dailyCategories] = await Promise.all([
    getDailySummary(user.id, date),
    getDailyHabits(user.id, date),
    getDailyMeals(user.id, date),
    getDailyIntake(user.id, date),
    getCategories(user.id, "daily"),
  ]);
  const mealsHabitActive = habits.some((h) => h.kind === "meal");
  const longLabel = formatDayLong(date);

  // Return the user to the week this date belongs to so the back link feels right.
  const backToWeek = `/week?start=${weekStartISO(parseLocalISO(date))}`;
  const prevDay = addDaysISO(date, -1);
  const nextDay = addDaysISO(date, 1);

  return (
    <main className={styles.main}>
      <header className={styles.header}>
        <div>
          <p className={styles.date}>{longLabel}</p>
          <h1 className={styles.h1}>
            Looking <span className={styles.accent}>back</span>
          </h1>
        </div>
        <Link href={backToWeek} className={styles.badge} aria-label="Back to week">
          ← Week
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
          <WaterHeroCard summary={summary} />
          {mealsHabitActive ? <MealsCard date={date} meals={meals} /> : null}
          <IntakeCard date={date} intake={intake} />
        </div>
      </section>

      <section className={styles.section}>
        <header className={styles.sectionHeader}>
          <h2 className={styles.h2}>Daily habits</h2>
          <span className={styles.muted}>tap to backfill</span>
        </header>
        <HabitChecks date={date} habits={habits} categories={dailyCategories} />
      </section>

      <section className={styles.section}>
        <header className={styles.sectionHeader}>
          <h2 className={styles.h2}>Log</h2>
          <span className={styles.muted}>{summary.logs.length} entries</span>
        </header>
        {summary.logs.length === 0 ? (
          <Card className={styles.empty}>
            <p>No entries logged this day.</p>
            <Link href="/">
              <Button size="md" variant="outline">
                Back to today
              </Button>
            </Link>
          </Card>
        ) : (
          <ul className={styles.logList}>
            {summary.logs.map((log) => (
              <WaterLogItem key={log.id} log={log} />
            ))}
          </ul>
        )}
      </section>

      <nav className={styles.section} aria-label="Adjacent days">
        <div className={styles.sectionHeader}>
          <Link href={`/day/${prevDay}`} className={styles.link}>
            ← {prevDay}
          </Link>
          {nextDay <= today ? (
            <Link
              href={nextDay === today ? "/" : `/day/${nextDay}`}
              className={styles.link}
            >
              {nextDay} →
            </Link>
          ) : null}
        </div>
      </nav>
    </main>
  );
}
