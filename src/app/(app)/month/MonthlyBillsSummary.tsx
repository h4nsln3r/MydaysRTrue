"use client";

import { formatKr, monthlyTaskDisplayTitle } from "@/lib/monthly-finance";
import {
  effectiveBillAmountKr,
  sharedMonthlyBills,
  sumMonthlyBills,
} from "@/lib/monthly-bills";
import type { MonthlyTaskForMonth, TaskCategory } from "@/lib/tasks";
import styles from "./monthly-bills-summary.module.scss";

interface Props {
  tasks: MonthlyTaskForMonth[];
  categories: TaskCategory[];
}

export function MonthlyBillsSummary({ tasks, categories }: Props) {
  const summary = sumMonthlyBills(tasks, categories);
  if (summary.billCount === 0) return null;

  const sharedBills = sharedMonthlyBills(tasks, categories);
  const hasShared = summary.sharedCount > 0;
  const hasSolo = summary.soloCount > 0;

  return (
    <aside className={styles.summary} aria-label="Sammanfattning räkningar">
      <p className={styles.title}>Räkningar den här månaden</p>

      {hasShared ? (
        <div className={styles.sharedBlock}>
          <div className={styles.grid}>
            <div className={styles.stat}>
              <span className={styles.statLabel}>
                Delade räkningar
                {summary.sharedCount > 0
                  ? ` (${summary.sharedCount})`
                  : ""}
              </span>
              <span className={styles.statValue}>
                {summary.sharedWithAmount > 0
                  ? formatKr(summary.sharedKr)
                  : "—"}
              </span>
            </div>
            <div className={styles.stat}>
              <span className={styles.statLabel}>Efter delning (÷ 2)</span>
              <span className={styles.statValueAccent}>
                {summary.sharedWithAmount > 0
                  ? formatKr(summary.perPersonKr)
                  : "—"}
              </span>
            </div>
          </div>

          {sharedBills.length > 0 ? (
            <ul className={styles.billList}>
              {sharedBills.map((bill) => (
                <SharedBillRow key={bill.id} bill={bill} />
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      {hasSolo ? (
        <div className={styles.grid}>
          <div className={styles.stat}>
            <span className={styles.statLabel}>
              Bara jag
              {summary.soloCount > 0 ? ` (${summary.soloCount})` : ""}
            </span>
            <span className={styles.statValue}>
              {summary.soloWithAmount > 0 ? formatKr(summary.soloKr) : "—"}
            </span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statLabel}>Min andel totalt</span>
            <span className={styles.statValueAccent}>
              {summary.withAmount > 0 ? formatKr(summary.myShareKr) : "—"}
            </span>
          </div>
        </div>
      ) : null}

      {hasShared && hasSolo ? (
        <p className={styles.totalLine}>
          Alla räkningar:{" "}
          {summary.withAmount > 0 ? formatKr(summary.totalKr) : "—"}
        </p>
      ) : null}

      {!hasShared && hasSolo ? (
        <div className={styles.grid}>
          <div className={styles.stat}>
            <span className={styles.statLabel}>Totalt</span>
            <span className={styles.statValue}>
              {summary.withAmount > 0 ? formatKr(summary.totalKr) : "—"}
            </span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statLabel}>Min andel</span>
            <span className={styles.statValueAccent}>
              {summary.withAmount > 0 ? formatKr(summary.myShareKr) : "—"}
            </span>
          </div>
        </div>
      ) : null}

      <p className={styles.hint}>
        {summary.missingAmount > 0
          ? `${summary.missingAmount} räkning${
              summary.missingAmount === 1 ? "" : "ar"
            } saknar kostnad — lägg till under respektive räkning. `
          : ""}
        {hasShared && hasSolo
          ? "Delade räkningar delas på dig och Julia. Räkningar som bara du betalar räknas helt på din andel."
          : hasShared
            ? "Delat på dig och Julia."
            : "Alla räkningar betalas bara av dig denna månad."}
      </p>
    </aside>
  );
}

function SharedBillRow({ bill }: { bill: MonthlyTaskForMonth }) {
  const amount = effectiveBillAmountKr(bill);
  return (
    <li className={styles.billRow}>
      <span className={styles.billName}>
        {monthlyTaskDisplayTitle(bill, bill.completion)}
      </span>
      <span className={styles.billAmount}>
        {amount != null ? formatKr(amount) : "—"}
      </span>
    </li>
  );
}
