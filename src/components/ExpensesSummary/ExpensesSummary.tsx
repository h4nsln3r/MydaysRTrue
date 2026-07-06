import { formatDayShort } from "@/lib/date";
import {
  formatExpenseKr,
  type ExpenseSummary,
} from "@/lib/expenses";
import styles from "./ExpensesSummary.module.scss";

interface Props {
  summary: ExpenseSummary;
  title: string;
  emptyMessage?: string;
}

export function ExpensesSummary({
  summary,
  title,
  emptyMessage = "Inga utgifter loggade ännu.",
}: Props) {
  if (summary.entries.length === 0) return null;

  return (
    <section className={styles.panel} aria-label={title}>
      <header className={styles.header}>
        <div className={styles.heading}>
          <span className={styles.icon} aria-hidden>
            💸
          </span>
          <h3 className={styles.title}>{title}</h3>
        </div>
        <p className={styles.total}>{formatExpenseKr(summary.totalKr)}</p>
      </header>

      <ul className={styles.list}>
        {summary.entries.map((entry) => (
          <li key={entry.id} className={styles.row}>
            <span
              className={styles.rowIcon}
              aria-hidden
              style={{ borderColor: entry.accent }}
            >
              {entry.icon}
            </span>
            <div className={styles.rowBody}>
              <span className={styles.rowTitle}>{entry.title}</span>
              <span className={styles.rowDetail}>
                {entry.description}
                {entry.note?.trim() && entry.note.trim() !== entry.description
                  ? ` · ${entry.note.trim()}`
                  : ""}
              </span>
              <span className={styles.rowMeta}>
                {formatDayShort(entry.localDate)}
                {entry.scope === "monthly" ? " · månad" : " · vecka"}
              </span>
            </div>
            <span className={styles.rowAmount}>
              {formatExpenseKr(entry.amountKr)}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
