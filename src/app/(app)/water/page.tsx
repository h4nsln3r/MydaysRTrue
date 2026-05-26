import Link from "next/link";
import { redirect } from "next/navigation";
import { Card } from "@/components/Card/Card";
import { Button } from "@/components/Button/Button";
import { WaterLogItem } from "@/components/WaterLogItem/WaterLogItem";
import { WaterHeroCard } from "@/components/WaterHeroCard/WaterHeroCard";
import { createClient } from "@/lib/supabase/server";
import { getDailySummary } from "@/lib/water.server";
import { formatDateLong, todayLocalISO } from "@/lib/date";
import { QuickAddRow } from "../QuickAddRow";
import styles from "../dashboard.module.scss";

export const dynamic = "force-dynamic";

export default async function WaterPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const summary = await getDailySummary(user.id, todayLocalISO());

  return (
    <main className={styles.main}>
      <header className={styles.header}>
        <div>
          <p className={styles.date}>{formatDateLong()}</p>
          <h1 className={styles.h1}>
            <span className={styles.accent}>Water</span> log
          </h1>
        </div>
        <Link href="/" className={styles.badge} aria-label="Back to day">
          ← Day
        </Link>
      </header>

      <WaterHeroCard summary={summary} />

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
