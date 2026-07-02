"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/Button/Button";
import { Input } from "@/components/Input/Input";
import { ActivityCategoryBadge } from "@/components/ActivityCategoryBadge/ActivityCategoryBadge";
import {
  setMonthlyBillAmountAction,
  toggleMonthlyTaskDoneAction,
} from "@/app/(app)/tasks-actions";
import { monthPlanEkonomiHref, parseKrInput } from "@/lib/monthly-finance";
import {
  effectiveBillAmountKr,
  formatBillAmountKr,
  isMonthlyBill,
  isMonthlyFinanceTask,
} from "@/lib/monthly-bills";
import {
  formatMonthlyTaskDetail,
  type MonthlyTaskForMonth,
  type TaskCategory,
} from "@/lib/tasks";
import type { PlanSortableProps } from "@/components/DayActivitiesCard/usePlanSortable";
import styles from "@/components/WeeklyTasksDayCard/WeeklyTasksDayCard.module.scss";

interface Props extends PlanSortableProps {
  task: MonthlyTaskForMonth;
  monthStart: string;
  categories: TaskCategory[];
  expanded: boolean;
  busy: boolean;
  pending: boolean;
  onToggleExpand: () => void;
  onError: (msg: string | null) => void;
  onPendingId: (id: string | null) => void;
  onDone: () => void;
  planningMode?: boolean;
}

export function MonthlyTaskDayRow({
  task,
  monthStart,
  categories,
  expanded,
  busy,
  pending,
  onToggleExpand,
  onError,
  onPendingId,
  onDone,
  dragHandle,
  sortableRef,
  sortableStyle,
  planningMode = false,
}: Props) {
  const router = useRouter();
  const done = Boolean(task.completion?.doneAt);
  const isFinance = isMonthlyFinanceTask(task);
  const detail = formatMonthlyTaskDetail(task, task.completion);
  const billAmountLabel = formatBillAmountKr(task);
  const isBill = isMonthlyBill(task, categories);
  const category = task.categoryId
    ? categories.find((c) => c.id === task.categoryId) ?? null
    : null;
  const needsExpand =
    !isFinance && (isBill || task.completionKind === "amount");
  const monthHref = `/month?m=${monthStart.slice(0, 7)}&view=plan`;
  const ekonomiHref = monthPlanEkonomiHref(monthStart);
  const [, startTransition] = useTransition();

  const savedNote =
    task.completionKind === "amount" && task.completion?.note
      ? task.completion.note
      : task.completionKind === "simple"
        ? (task.completion?.note?.trim() ?? "")
        : "";
  const [note, setNote] = useState(savedNote);
  const [amount, setAmount] = useState(
    task.completion?.amount != null
      ? String(task.completion.amount)
      : task.defaultAmountKr != null
        ? String(task.defaultAmountKr)
        : "",
  );
  const [billAmount, setBillAmount] = useState(
    task.completion?.amount != null
      ? String(task.completion.amount)
      : task.defaultAmountKr != null
        ? String(task.defaultAmountKr)
        : "",
  );

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) => {
    onError(null);
    onPendingId(task.id);
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) onError(res.error ?? "Kunde inte uppdatera.");
      onPendingId(null);
      onDone();
    });
  };

  const openEkonomi = () => {
    if (planningMode) return;
    router.push(ekonomiHref);
  };

  const toggleSimple = () => {
    if (isFinance) {
      openEkonomi();
      return;
    }
    if (task.completionKind === "amount") {
      onToggleExpand();
      return;
    }
    if (isBill) {
      onToggleExpand();
      return;
    }
    run(() =>
      toggleMonthlyTaskDoneAction({
        taskId: task.id,
        monthStart,
        done: !done,
      }),
    );
  };

  const saveBillAmount = () => {
    const parsed = parseKrInput(billAmount);
    run(() =>
      setMonthlyBillAmountAction({
        taskId: task.id,
        monthStart,
        amountKr: parsed,
      }),
    );
  };

  const billAmountForDone = () => {
    const fromField = parseKrInput(billAmount);
    if (fromField != null) return fromField;
    return effectiveBillAmountKr(task) ?? undefined;
  };

  const completeSimple = () =>
    run(async () => {
      const res = await toggleMonthlyTaskDoneAction({
        taskId: task.id,
        monthStart,
        done: true,
        note,
        amount: isBill ? billAmountForDone() : undefined,
      });
      return res;
    });

  const completeAmount = () => {
    const parsed = parseKrInput(amount);
    if (parsed == null) {
      onError("Ange ett belopp.");
      return;
    }
    run(() =>
      toggleMonthlyTaskDoneAction({
        taskId: task.id,
        monthStart,
        done: true,
        amount: parsed,
        note,
      }),
    );
  };

  const uncomplete = () =>
    run(() =>
      toggleMonthlyTaskDoneAction({
        taskId: task.id,
        monthStart,
        done: false,
      }),
    );

  return (
    <li
      ref={sortableRef}
      style={sortableStyle}
      className={[
        styles.task,
        dragHandle ? styles.taskDraggable : "",
        done ? styles.taskDone : "",
        busy ? styles.taskBusy : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {dragHandle}
      <button
        type="button"
        className={[styles.checkBtn, done ? styles.checkBtnDone : ""]
          .filter(Boolean)
          .join(" ")}
        aria-label={done ? "Markera ej klar" : "Markera klar"}
        aria-pressed={done}
        disabled={pending || planningMode}
        onClick={planningMode ? undefined : toggleSimple}
      >
        {done ? (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path
              d="M5 12.5 10 17.5 19 7.5"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        ) : (
          <span aria-hidden />
        )}
      </button>

      <button
        type="button"
        className={styles.taskBody}
        onClick={
          planningMode
            ? undefined
            : isFinance
              ? openEkonomi
              : onToggleExpand
        }
        aria-expanded={planningMode || isFinance ? undefined : expanded}
        disabled={pending || planningMode}
      >
        <span
          className={styles.taskIcon}
          aria-hidden
          style={{ borderColor: task.accent }}
        >
          {task.icon}
        </span>
        <span className={styles.taskMeta}>
          {category ? (
            <ActivityCategoryBadge
              icon={category.icon}
              label={category.name}
              accent={category.accent}
              done={done}
            />
          ) : (
            <ActivityCategoryBadge
              icon="📅"
              label="Månad"
              accent="#f59e0b"
              done={done}
            />
          )}
          <span className={styles.taskTitle}>{task.title}</span>
          {isBill && billAmountLabel ? (
            <span className={styles.taskDetail}>{billAmountLabel}</span>
          ) : detail ? (
            <span className={styles.taskDetail}>{detail}</span>
          ) : !done && isFinance ? (
            <span className={styles.planHint}>Öppna ekonomitabellen</span>
          ) : null}
        </span>
        {!planningMode && needsExpand ? (
          <span
            className={[styles.chevron, expanded ? styles.chevronUp : ""]
              .filter(Boolean)
              .join(" ")}
            aria-hidden
          >
            ▾
          </span>
        ) : null}
      </button>

      {expanded && !planningMode ? (
        <div className={styles.taskActions}>
          {isBill ? (
            <>
              <Input
                label="Kostnad den här månaden (kr)"
                value={billAmount}
                onChange={(e) => setBillAmount(e.target.value)}
                placeholder={
                  task.defaultAmountKr != null
                    ? String(task.defaultAmountKr)
                    : "t.ex. 850"
                }
                inputMode="decimal"
                disabled={pending}
              />
              <Button
                type="button"
                variant="outline"
                size="md"
                fullWidth
                loading={pending && busy}
                disabled={pending}
                onClick={saveBillAmount}
              >
                Spara kostnad
              </Button>
            </>
          ) : null}
          {task.completionKind === "finance" ? (
            <>
              <p className={styles.planHint}>
                Fyll i ekonomitabellen i månadsvyn.
              </p>
              <Link href={monthHref} className={styles.weekLink}>
                Öppna månadsplan →
              </Link>
              {done && detail ? (
                <p className={styles.taskDetail}>{detail}</p>
              ) : null}
            </>
          ) : !done ? (
            <>
              {task.completionKind === "amount" && task.notes ? (
                <p className={styles.notesBlock}>{task.notes}</p>
              ) : null}
              {task.completionKind === "amount" ? (
                <Input
                  label="Belopp (kr)"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder={
                    task.defaultAmountKr != null
                      ? String(task.defaultAmountKr)
                      : "t.ex. 1500"
                  }
                  inputMode="decimal"
                  required
                  disabled={pending}
                />
              ) : null}
              <Input
                label="Kommentar (valfritt)"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Skriv en kommentar"
                maxLength={500}
                disabled={pending}
              />
              <Button
                type="button"
                variant="primary"
                size="md"
                fullWidth
                loading={pending && busy}
                disabled={pending}
                onClick={
                  task.completionKind === "amount" ? completeAmount : completeSimple
                }
              >
                Markera klart
              </Button>
            </>
          ) : (
            <>
              {isBill && billAmountLabel ? (
                <p className={styles.taskDetail}>{billAmountLabel}</p>
              ) : detail ? (
                <p className={styles.taskDetail}>{detail}</p>
              ) : (
                <p className={styles.empty}>Ingen kommentar.</p>
              )}
              <button
                type="button"
                className={styles.undoBtn}
                onClick={uncomplete}
                disabled={pending}
              >
                Ångra klarmarkering
              </button>
            </>
          )}
          <Link href={monthHref} className={styles.weekLink}>
            Månadsplan →
          </Link>
        </div>
      ) : null}
    </li>
  );
}
