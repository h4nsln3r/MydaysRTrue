import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Card } from "@/components/Card/Card";
import { getDailySummary } from "@/lib/water.server";
import { formatMl } from "@/lib/water";
import { AddWaterForm } from "./AddWaterForm";
import { RecentLogs } from "./RecentLogs";
import styles from "./add-water.module.scss";

export const dynamic = "force-dynamic";

export default async function AddWaterPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const summary = await getDailySummary(user.id);

  return (
    <main className={styles.main}>
      <header className={styles.header}>
        <p className={styles.eyebrow}>+ Log water</p>
        <h1 className={styles.title}>How much?</h1>
        <p className={styles.lead}>
          Drank{" "}
          <strong className={styles.strong}>{formatMl(summary.totalMl)}</strong> of{" "}
          {formatMl(summary.goalMl)} today.
        </p>
      </header>

      <Card accent>
        <AddWaterForm />
      </Card>

      <section className={styles.section}>
        <h2 className={styles.h2}>Today</h2>
        <RecentLogs logs={summary.logs} />
      </section>
    </main>
  );
}
