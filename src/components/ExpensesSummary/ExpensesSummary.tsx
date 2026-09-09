import { formatDayShort } from "@/lib/date";
import {
  formatExpenseKr,
  mergeExpenseSummaries,
  SPEND_KIND_TOTAL_LABEL,
  SPEND_KIND_TOTAL_ORDER,
  type ExpenseSummary,
  type SpendKindTotalKey,
} from "@/lib/expenses";
import { SPEND_KIND_ICON, SPEND_KIND_LABEL, type SpendKind } from "@/lib/tasks";
import styles from "./ExpensesSummary.module.scss";

interface Props {
  summary: ExpenseSummary;
  title: string;
  icon?: string;
  variant?: "expense" | "shopping";
  emptyMessage?: string;
}

function KindTotals({
  totalsByKind,
}: {
  totalsByKind: ExpenseSummary["totalsByKind"];
}) {
  const keys = SPEND_KIND_TOTAL_ORDER.filter((key) => totalsByKind[key] > 0);
  if (keys.length === 0) return null;
  const sharedHalf = totalsByKind.shared / 2;

  return (
    <ul className={styles.split} aria-label="Fördelning">
      {keys.map((key) => (
        <li key={key} className={styles.splitItem}>
          <span className={styles.splitLabel}>
            {kindIcon(key)} {SPEND_KIND_TOTAL_LABEL[key]}
          </span>
          <span className={styles.splitAmount}>
            {formatExpenseKr(totalsByKind[key])}
          </span>
          {key === "shared" ? (
            <span className={styles.splitHint}>
              Hälften {formatExpenseKr(sharedHalf)}
            </span>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

function kindIcon(key: SpendKindTotalKey): string {
  if (key === "unset") return "❔";
  return SPEND_KIND_ICON[key];
}

export function SpendSplitOverview({
  shopping,
  expenses,
  title,
}: {
  shopping: ExpenseSummary;
  expenses: ExpenseSummary;
  title: string;
}) {
  const combined = mergeExpenseSummaries(shopping, expenses);
  if (combined.entries.length === 0) return null;

  return (
    <section className={[styles.panel, styles.panelSplit].join(" ")} aria-label={title}>
      <header className={styles.header}>
        <div className={styles.heading}>
          <span className={styles.icon} aria-hidden>
            📊
          </span>
          <h3 className={styles.title}>{title}</h3>
        </div>
        <p className={styles.total}>{formatExpenseKr(combined.totalKr)}</p>
      </header>
      <KindTotals totalsByKind={combined.totalsByKind} />
    </section>
  );
}

export function ExpensesSummary({
  summary,
  title,
  icon = "💸",
  variant = "expense",
}: Props) {
  if (summary.entries.length === 0) return null;

  return (
    <section
      className={[
        styles.panel,
        variant === "shopping" ? styles.panelShopping : "",
      ]
        .filter(Boolean)
        .join(" ")}
      aria-label={title}
    >
      <header className={styles.header}>
        <div className={styles.heading}>
          <span className={styles.icon} aria-hidden>
            {icon}
          </span>
          <h3 className={styles.title}>{title}</h3>
        </div>
        <p
          className={[
            styles.total,
            variant === "shopping" ? styles.totalShopping : "",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          {formatExpenseKr(summary.totalKr)}
        </p>
      </header>

      <KindTotals totalsByKind={summary.totalsByKind} />

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
              <span className={styles.rowTitle}>
                {entry.title}
                {entry.spendKind ? (
                  <span className={styles.kindBadge}>
                    {SPEND_KIND_ICON[entry.spendKind]}{" "}
                    {SPEND_KIND_LABEL[entry.spendKind as SpendKind]}
                  </span>
                ) : null}
              </span>
              <span className={styles.rowDetail}>
                {entry.description}
                {entry.amountExpr ? ` · ${entry.amountExpr}` : ""}
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
