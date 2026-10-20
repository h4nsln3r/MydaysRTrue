import Link from "next/link";
import { Card } from "@/components/Card/Card";
import { WaterLogItem } from "@/components/WaterLogItem/WaterLogItem";
import { getAuthUser } from "@/lib/auth.server";
import { QuickAddRow } from "../QuickAddRow";
import styles from "../dashboard.module.scss";
import { getCachedDailySummary, getPlanRevealGate } from "./cached";
import { RevealAfterPlan } from "./FadeIn";

export async function DayWaterSection({ date }: { date: string }) {
  await getPlanRevealGate().promise;
  const user = await getAuthUser();
  const summary = await getCachedDailySummary(user.id, date);

  return (
    <RevealAfterPlan>
    <section className={styles.section}>
      <header className={styles.sectionHeader}>
        <h2 className={styles.h2}>Vattenlogg</h2>
        <Link href={`/add-water?date=${date}`} className={styles.link}>
          Mer →
        </Link>
      </header>
      <QuickAddRow localDate={date} />
      {summary.logs.length === 0 ? (
        <Card className={styles.empty}>
          <p>Inget vatten loggat den här dagen.</p>
        </Card>
      ) : (
        <ul className={styles.logList}>
          {summary.logs.map((log) => (
            <WaterLogItem key={log.id} log={log} />
          ))}
        </ul>
      )}
    </section>
    </RevealAfterPlan>
  );
}
