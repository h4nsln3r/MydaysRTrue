"use client";

import { formatKr } from "@/lib/monthly-finance";
import { sumMonthlyBills } from "@/lib/monthly-bills";
import type { MonthlyTaskForMonth, TaskCategory } from "@/lib/tasks";
import styles from "./monthly-bills-summary.module.scss";

interface Props {
  tasks: MonthlyTaskForMonth[];
  categories: TaskCategory[];
}

export function MonthlyBillsSummary({ tasks, categories }: Props) {
  const summary = sumMonthlyBills(tasks, categories);
  if (summary.billCount === 0) return null;

  return (
    <aside className={styles.summary} aria-label="Sammanfattning räkningar">
      <p className={styles.title}>Räkningar den här månaden</p>
      <div className={styles.grid}>
        <div className={styles.stat}>
          <span className={styles.statLabel}>Totalt</span>
          <span className={styles.statValue}>
            {summary.withAmount > 0 ? formatKr(summary.totalKr) : "—"}
          </span>
        </div>
        {summary.soloCount > 0 ? (
          <div className={styles.stat}>
            <span className={styles.statLabel}>Min andel</span>
            <span className={styles.statValueAccent}>
              {summary.withAmount > 0 ? formatKr(summary.myShareKr) : "—"}
            </span>
          </div>
        ) : (
          <div className={styles.stat}>
            <span className={styles.statLabel}>Per person (÷ 2)</span>
            <span className={styles.statValueAccent}>
              {summary.withAmount > 0 ? formatKr(summary.perPersonKr) : "—"}
            </span>
          </div>
        )}
        {summary.soloCount > 0 ? (
          <>
            <div className={styles.stat}>
              <span className={styles.statLabel}>Delat per person</span>
              <span className={styles.statValue}>
                {summary.sharedKr > 0 ? formatKr(summary.perPersonKr) : "—"}
              </span>
            </div>
            <div className={styles.stat}>
              <span className={styles.statLabel}>Bara jag</span>
              <span className={styles.statValue}>
                {summary.soloWithAmount > 0 ? formatKr(summary.soloKr) : "—"}
              </span>
            </div>
          </>
        ) : null}
      </div>
      <p className={styles.hint}>
        {summary.missingAmount > 0
          ? `${summary.missingAmount} räkning${
              summary.missingAmount === 1 ? "" : "ar"
            } saknar kostnad — lägg till under respektive räkning. `
          : ""}
        {summary.soloCount > 0
          ? "Delade räkningar delas på två. Räkningar som bara du betalar räknas helt på din andel."
          : "Delat på två personer i hushållet."}
      </p>
    </aside>
  );
}
