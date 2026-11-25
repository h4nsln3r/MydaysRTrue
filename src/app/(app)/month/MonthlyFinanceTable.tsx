"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveMonthlyFinanceAction, setMonthlyBillAmountAction } from "@/app/(app)/tasks-actions";
import { Button } from "@/components/Button/Button";
import { Input } from "@/components/Input/Input";
import {
  EMPTY_FINANCE_BALANCES,
  FINANCE_TABLE_ROWS,
  financeTotal,
  carpayAmountFromSalary,
  carpayUsesSalaryShare,
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
  salaryTaskId?: string | null;
  salaryAmount?: number | null;
  readOnly?: boolean;
  /** Future month — schedule amounts only, not account balances. */
  planOnly?: boolean;
}

export function MonthlyFinanceTable({
  monthStart,
  financeTaskId,
  snapshot,
  salaryTaskId = null,
  salaryAmount = null,
  readOnly = false,
  planOnly = false,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);

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
  const [salary, setSalary] = useState(
    salaryAmount != null ? String(salaryAmount) : "",
  );
  const done = Boolean(snapshot?.doneAt);

  useEffect(() => {
    setBalances(initialBalances);
    setNote(snapshot?.note ?? "");
    setSalary(salaryAmount != null ? String(salaryAmount) : "");
    setEditing(false);
  }, [initialBalances, snapshot?.note, salaryAmount]);

  const lfSum = lfTotal(balances);
  const grand = financeTotal(balances);
  const carpayFromSalary = carpayUsesSalaryShare(monthStart);
  const carpayTarget = carpayFromSalary
    ? carpayAmountFromSalary(parseKrInput(salary), monthStart)
    : null;

  /** Locked until you tap the pencil (or while still open for first fill on plan). */
  const locked = planOnly || ((!editing) && (readOnly || done));
  const showPencil = !planOnly && !editing && (readOnly || done);
  const showEditFooter = editing || (!readOnly && !done && !planOnly);

  const resetFromProps = () => {
    setBalances(initialBalances);
    setNote(snapshot?.note ?? "");
    setSalary(salaryAmount != null ? String(salaryAmount) : "");
    setError(null);
  };

  const cancelEdit = () => {
    resetFromProps();
    setEditing(false);
  };

  const save = (markDone: boolean) => {
    if (!financeTaskId) {
      setError("Ekonomiuppgiften saknas.");
      return;
    }
    setError(null);
    startTransition(async () => {
      if (salaryTaskId) {
        const parsed = parseKrInput(salary);
        const salaryRes = await setMonthlyBillAmountAction({
          taskId: salaryTaskId,
          monthStart,
          amountKr: parsed,
        });
        if (!salaryRes.ok) {
          setError(salaryRes.error ?? "Kunde inte spara lön.");
          return;
        }
      }

      const res = await saveMonthlyFinanceAction({
        taskId: financeTaskId,
        monthStart,
        balances,
        note,
        done: markDone,
      });
      if (!res.ok) {
        setError(res.error ?? "Kunde inte spara.");
        return;
      }
      setEditing(false);
      router.refresh();
    });
  };

  const saveSalary = () => {
    if (!salaryTaskId) return;
    const parsed = parseKrInput(salary);
    setError(null);
    startTransition(async () => {
      const res = await setMonthlyBillAmountAction({
        taskId: salaryTaskId,
        monthStart,
        amountKr: parsed,
      });
      if (!res.ok) setError(res.error ?? "Kunde inte spara lön.");
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
            {planOnly
              ? "Planera när ekonomin ska göras — saldon fylls i efter månadens slut"
              : editing
                ? "Rätta beloppen och spara"
                : "Fyll i saldo per konto — LF-total och summa räknas ut automatiskt"}
          </p>
        </div>
        {done && !editing ? (
          <span className={styles.doneBadge} aria-label="Ekonomi klar">
            ✓ Klar
          </span>
        ) : null}
      </header>

      {salaryTaskId ? (
        <div className={styles.salaryRow}>
          <label className={styles.salaryLabel} htmlFor="salary-amount">
            Lön den här månaden
          </label>
          {locked ? (
            <span className={styles.salaryValue}>
              {salaryAmount != null ? formatKr(salaryAmount) : "—"}
            </span>
          ) : (
            <div className={styles.salaryInputRow}>
              <input
                id="salary-amount"
                type="text"
                inputMode="decimal"
                className={styles.amountInput}
                value={salary}
                onChange={(e) => setSalary(e.target.value)}
                placeholder="t.ex. 32000"
                aria-label="Lön den här månaden"
                disabled={pending}
              />
              {!editing ? (
                <Button
                  type="button"
                  variant="outline"
                  size="md"
                  loading={pending}
                  disabled={pending}
                  onClick={saveSalary}
                >
                  Spara lön
                </Button>
              ) : null}
            </div>
          )}
          {carpayFromSalary ? (
            <p className={styles.carpayShare}>
              <span>Carpay (10 % av lönen)</span>
              <strong>{carpayTarget != null ? formatKr(carpayTarget) : "—"}</strong>
            </p>
          ) : null}
        </div>
      ) : null}

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
                    {row.hint && !locked ? (
                      <span className={styles.rowHint}>{row.hint}</span>
                    ) : null}
                  </td>
                  <td className={styles.amountCell}>
                    {locked ? (
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

      {showEditFooter ? (
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
            {editing ? (
              <>
                <Button
                  type="button"
                  variant="ghost"
                  size="md"
                  disabled={pending}
                  onClick={cancelEdit}
                >
                  Avbryt
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  size="md"
                  loading={pending}
                  disabled={pending}
                  onClick={() => save(done)}
                >
                  Spara
                </Button>
              </>
            ) : (
              <>
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
              </>
            )}
          </div>
        </div>
      ) : locked && snapshot?.note ? (
        <p className={styles.readNote}>
          <span className={styles.readNoteLabel}>Kommentar</span>
          {snapshot.note}
        </p>
      ) : null}

      {showPencil ? (
        <div className={styles.editBar}>
          {error ? <p className={styles.error}>{error}</p> : null}
          <button
            type="button"
            className={styles.pencil}
            aria-label="Redigera ekonomi"
            title="Redigera"
            disabled={pending}
            onClick={() => {
              setError(null);
              setEditing(true);
            }}
          >
            ✎
          </button>
        </div>
      ) : null}
    </section>
  );
}
