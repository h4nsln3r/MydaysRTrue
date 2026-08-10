"use client";

import { CompletionQuickEdit } from "@/components/CompletionQuickEdit/CompletionQuickEdit";
import { formatDayShort, formatWeekdayShort } from "@/lib/date";
import type { DayCompletion } from "@/lib/completions";
import styles from "./WeekCompletionsList.module.scss";

interface Props {
  weekStart: string;
  completions: DayCompletion[];
}

export function WeekCompletionsList({ completions }: Props) {
  if (completions.length === 0) {
    return (
      <div className={styles.wrap}>
        <header className={styles.header}>
          <h2 className={styles.title}>Klart utan veckotask</h2>
          <span className={styles.muted}>bok · film · spelning · version</span>
        </header>
        <p className={styles.empty}>Inget klart den här veckan.</p>
      </div>
    );
  }

  return (
    <div className={styles.wrap}>
      <header className={styles.header}>
        <h2 className={styles.title}>Klart utan veckotask</h2>
        <span className={styles.muted}>bok · film · spelning · version</span>
      </header>
      <ul className={styles.list}>
        {completions.map((item) => (
          <li key={item.id} className={styles.item}>
            <span className={styles.date}>
              {formatWeekdayShort(item.date)} {formatDayShort(item.date)}
            </span>
            <div className={styles.meta}>
              <span className={styles.itemTitle}>{item.title}</span>
              <span className={styles.itemSub}>{item.subtitle}</span>
              {item.note ? (
                <span className={styles.itemNote}>{item.note}</span>
              ) : null}
            </div>
            <CompletionQuickEdit item={item} />
          </li>
        ))}
      </ul>
    </div>
  );
}
