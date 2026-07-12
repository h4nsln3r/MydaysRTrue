import { createClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
import { Card } from "@/components/Card/Card";
import { getDailySummary } from "@/lib/water.server";
import { formatMl } from "@/lib/water";
import { formatDateLong, parseLocalISO, todayLocalISO, weekEndISO } from "@/lib/date";
import { AddWaterForm } from "./AddWaterForm";
import { RecentLogs } from "./RecentLogs";
import styles from "./add-water.module.scss";

export const dynamic = "force-dynamic";

interface AddWaterPageProps {
  searchParams: Promise<{ date?: string }>;
}

function resolveLocalDate(dateParam: string | undefined, today: string): string {
  if (dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)) return dateParam;
  return today;
}

export default async function AddWaterPage({ searchParams }: AddWaterPageProps) {
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

  return (
    <main className={styles.main}>
      <header className={styles.header}>
        <p className={styles.eyebrow}>+ Log water</p>
        <h1 className={styles.title}>How much?</h1>
        <p className={styles.lead}>
          Drank{" "}
          <strong className={styles.strong}>{formatMl(summary.totalMl)}</strong> of{" "}
          {formatMl(summary.goalMl)}{" "}
          {isToday ? "today" : `on ${formatDateLong(parseLocalISO(localDate))}`}.
        </p>
      </header>

      <Card accent>
        <AddWaterForm localDate={localDate} />
      </Card>

      <section className={styles.section}>
        <h2 className={styles.h2}>{isToday ? "Today" : formatDateLong(parseLocalISO(localDate))}</h2>
        <RecentLogs logs={summary.logs} />
      </section>
    </main>
  );
}
