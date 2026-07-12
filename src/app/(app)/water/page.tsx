import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Card } from "@/components/Card/Card";
import { Button } from "@/components/Button/Button";
import { WaterLogItem } from "@/components/WaterLogItem/WaterLogItem";
import { WaterHeroCard } from "@/components/WaterHeroCard/WaterHeroCard";
import { createClient } from "@/lib/supabase/server";
import { getDailySummary } from "@/lib/water.server";
import { formatDateLong, parseLocalISO, todayLocalISO, weekEndISO } from "@/lib/date";
import { QuickAddRow } from "../QuickAddRow";
import styles from "../dashboard.module.scss";

export const dynamic = "force-dynamic";

interface WaterPageProps {
  searchParams: Promise<{ date?: string }>;
}

function resolveLocalDate(dateParam: string | undefined, today: string): string {
  if (dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)) return dateParam;
  return today;
}

export default async function WaterPage({ searchParams }: WaterPageProps) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const today = todayLocalISO();
  const localDate = resolveLocalDate((await searchParams).date, today);
  if (localDate > weekEndISO(today)) notFound();

  const isToday = localDate === today;
  const summary = await getDailySummary(user.id, localDate);
  const backHref = isToday ? "/" : `/day/${localDate}`;
  const dateQuery = isToday ? "" : `?date=${localDate}`;
  const addWaterHref = `/add-water${dateQuery}`;

  return (
    <main className={styles.main}>
      <header className={styles.header}>
        <div>
          <p className={styles.date}>
            {formatDateLong(parseLocalISO(localDate))}
          </p>
          <h1 className={styles.h1}>
            <span className={styles.accent}>Water</span> log
          </h1>
        </div>
        <Link href={backHref} className={styles.badge} aria-label="Back to day">
          ← Day
        </Link>
      </header>

      <WaterHeroCard summary={summary} />

      <section className={styles.section}>
        <header className={styles.sectionHeader}>
          <h2 className={styles.h2}>Quick add</h2>
          <Link href={addWaterHref} className={styles.link}>
            More options →
          </Link>
        </header>
        <QuickAddRow localDate={localDate} />
      </section>

      <section className={styles.section}>
        <header className={styles.sectionHeader}>
          <h2 className={styles.h2}>
            {isToday ? "Today's log" : "Day's log"}
          </h2>
          <span className={styles.muted}>{summary.logs.length} entries</span>
        </header>
        {summary.logs.length === 0 ? (
          <Card className={styles.empty}>
            <p>{isToday ? "Nothing logged yet today." : "Nothing logged this day."}</p>
            <Link href={addWaterHref}>
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
