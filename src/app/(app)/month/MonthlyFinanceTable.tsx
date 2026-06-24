"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveMonthlyFinanceAction } from "@/app/(app)/tasks-actions";
import { Button } from "@/components/Button/Button";
import { Input } from "@/components/Input/Input";
import {
  EMPTY_FINANCE_BALANCES,
  FINANCE_TABLE_ROWS,
  financeTotal,
  formatKr,
  lfTotal,
  parseKrInput,
  type MonthlyFinanceBalances,
  type MonthlyFinanceSnapshot,
} from "@/lib/monthly-finance";
import styles from "./monthly-finance-table.module.scss";

interface Props {
  monthStart: string;
  financeTaskId: string | null;
  snapshot: MonthlyFinanceSnapshot | null;
  readOnly?: boolean;
}

export function MonthlyFinanceTable({
  monthStart,
  financeTaskId,
  snapshot,
  readOnly = false,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const initialBalances = useMemo(() => {
    const base = { ...EMPTY_FINANCE_BALANCES };
    if (snapshot) {
      for (const key of Object.keys(base) as (keyof MonthlyFinanceBalances)[]) {
        base[key] = snapshot.balances[key];
      }
    }
    return base;
  }, [snapshot]);

  const [balances, setBalances] =
    useState<MonthlyFinanceBalances>(initialBalances);
  const [note, setNote] = useState(snapshot?.note ?? "");
  const done = Boolean(snapshot?.doneAt);

  useEffect(() => {
    setBalances(initialBalances);
    setNote(snapshot?.note ?? "");
  }, [initialBalances, snapshot?.note]);

  const lfSum = lfTotal(balances);
  const grand = financeTotal(balances);

  const save = (markDone: boolean) => {
    if (!financeTaskId) {
      setError("Ekonomiuppgiften saknas.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await saveMonthlyFinanceAction({
        taskId: financeTaskId,
        monthStart,
        balances,
        note,
        done: markDone,
      });
      if (!res.ok) setError(res.error ?? "Kunde inte spara.");
      router.refresh();
    });
  };

  if (!financeTaskId) return null;

  return (
    <section className={styles.section} id="ekonomi" aria-label="Ekonomi">
      <header className={styles.header}>
        <div>
          <h2 className={styles.title}>Ekonomi</h2>
          <p className={styles.sub}>
            Fyll i saldo per konto — LF-total och summa räknas ut automatiskt
          </p>
        </div>
        {done ? (
          <span className={styles.doneBadge} aria-label="Ekonomi klar">
            ✓ Klar
          </span>
        ) : null}
      </header>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col">Konto</th>
              <th scope="col" className={styles.amountCol}>
                Belopp
              </th>
            </tr>
          </thead>
          <tbody>
            {FINANCE_TABLE_ROWS.map((row) => {
              if (row.kind === "lf-total") {
                return (
                  <tr key="lf-total" className={styles.lfTotalRow}>
                    <td>
                      <span className={styles.rowLabel}>{row.label}</span>
                      {row.hint ? (
                        <span className={styles.rowHint}>{row.hint}</span>
                      ) : null}
                    </td>
                    <td className={styles.amountCell}>
                      <span className={styles.computedValue}>
                        {formatKr(lfSum)}
                      </span>
                    </td>
                  </tr>
                );
              }

              if (row.kind === "grand-total") {
                return (
                  <tr key="grand-total" className={styles.grandTotalRow}>
                    <td>
                      <span className={styles.rowLabel}>{row.label}</span>
                    </td>
                    <td className={styles.amountCell}>
                      <span className={styles.grandValue}>{formatKr(grand)}</span>
                    </td>
                  </tr>
                );
              }

              const key = row.key!;
              const value = balances[key];

              return (
                <tr
                  key={key}
                  className={row.indent ? styles.indentRow : undefined}
                >
                  <td>
                    <span className={styles.rowLabel}>{row.label}</span>
                    {row.hint && !readOnly ? (
                      <span className={styles.rowHint}>{row.hint}</span>
                    ) : null}
                  </td>
                  <td className={styles.amountCell}>
                    {readOnly || done ? (
                      <span className={styles.readValue}>
                        {value != null ? formatKr(value) : "—"}
                      </span>
                    ) : (
                      <input
                        type="text"
                        inputMode="decimal"
                        className={styles.amountInput}
                        value={value != null ? String(value) : ""}
                        onChange={(e) =>
                          setBalances((prev) => ({
                            ...prev,
                            [key]: parseKrInput(e.target.value),
                          }))
                        }
                        placeholder="0"
                        aria-label={row.label}
                        disabled={pending}
                      />
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {!readOnly && !done ? (
        <div className={styles.footer}>
          <Input
            label="Kommentar (valfritt)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Anteckning om ekonomin"
            maxLength={500}
            disabled={pending}
          />
          {error ? <p className={styles.error}>{error}</p> : null}
          <div className={styles.actions}>
            <Button
              type="button"
              variant="ghost"
              size="md"
              disabled={pending}
              onClick={() => save(false)}
            >
              Spara utkast
            </Button>
            <Button
              type="button"
              variant="primary"
              size="md"
              loading={pending}
              disabled={pending}
              onClick={() => save(true)}
            >
              Klarmarkera ekonomi
            </Button>
          </div>
        </div>
      ) : readOnly && snapshot?.note ? (
        <p className={styles.readNote}>
          <span className={styles.readNoteLabel}>Kommentar</span>
          {snapshot.note}
        </p>
      ) : null}
    </section>
  );
}
