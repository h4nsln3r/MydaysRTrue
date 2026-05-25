import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Card } from "@/components/Card/Card";
import { Button } from "@/components/Button/Button";
import { WaterBottle } from "@/components/WaterBottle/WaterBottle";
import { WaterLogItem } from "@/components/WaterLogItem/WaterLogItem";
import { getDailySummary } from "@/lib/water.server";
import { formatMl } from "@/lib/water";
import { formatDateLong } from "@/lib/date";
import { QuickAddRow } from "./QuickAddRow";
import styles from "./dashboard.module.scss";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const summary = await getDailySummary(user.id);
  const remaining = Math.max(0, summary.goalMl - summary.totalMl);

  return (
    <main className={styles.main}>
      <header className={styles.header}>
        <div>
          <p className={styles.date}>{formatDateLong()}</p>
          <h1 className={styles.h1}>
            Stay <span className={styles.accent}>hydrated</span>
          </h1>
        </div>
        <span className={styles.badge}>Day 1 · Water</span>
      </header>

      <Card accent className={styles.heroCard}>
        <WaterBottle
          progress={summary.progress}
          totalMl={summary.totalMl}
          goalMl={summary.goalMl}
        />

        <p className={styles.statusLine}>
          {summary.goalMet ? (
            <>
              <span className={styles.statusDotOk} aria-hidden /> Day goal smashed — keep sipping.
            </>
          ) : (
            <>
              <span className={styles.statusDot} aria-hidden /> {formatMl(remaining)} left to hit
              your goal.
            </>
          )}
        </p>
      </Card>

      <section className={styles.section}>
        <header className={styles.sectionHeader}>
          <h2 className={styles.h2}>Quick add</h2>
          <Link href="/add-water" className={styles.link}>
            More options →
          </Link>
        </header>
        <QuickAddRow />
      </section>

      <section className={styles.section}>
        <header className={styles.sectionHeader}>
          <h2 className={styles.h2}>Today&apos;s log</h2>
          <span className={styles.muted}>{summary.logs.length} entries</span>
        </header>
        {summary.logs.length === 0 ? (
          <Card className={styles.empty}>
            <p>Nothing logged yet today.</p>
            <Link href="/add-water">
              <Button size="md" variant="outline">
                Log your first sip
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
    </main>
  );
}
