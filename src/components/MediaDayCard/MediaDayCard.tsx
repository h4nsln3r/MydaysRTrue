"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Card } from "@/components/Card/Card";
import { MediaDayLogging } from "@/components/MediaDayLogging/MediaDayLogging";
import type { DailyHabit } from "@/lib/habits";
import type { DailyMediaContext } from "@/lib/media";
import styles from "./MediaDayCard.module.scss";

interface Props {
  date: string;
  habit: DailyHabit;
  media: DailyMediaContext;
}

export function MediaDayCard({ date, habit, media }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const yearHref = `/year?y=${media.year}&view=plan`;

  const refresh = () => router.refresh();

  return (
    <Card
      className={[
        styles.card,
        habit.status ? styles[`card_${habit.status}`] : "",
        busy ? styles.cardBusy : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className={styles.header}>
        <div className={styles.identity}>
          <span
            className={styles.icon}
            aria-hidden
            style={{ borderColor: habit.accent }}
          >
            {habit.icon}
          </span>
          <span className={styles.title}>{habit.label}</span>
        </div>
        <Link href={yearHref} className={styles.monthLink}>
          År →
        </Link>
      </div>

      <MediaDayLogging
        date={date}
        media={media}
        yearHref={yearHref}
        variant="card"
        pending={busy}
        onError={setError}
        onPendingChange={setBusy}
        onDone={refresh}
      />

      {error ? <p className={styles.error}>{error}</p> : null}
    </Card>
  );
}
