"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/Input/Input";
import { Button } from "@/components/Button/Button";
import {
  archiveMonthlyTaskAction,
  scheduleMonthlyBillDayAction,
  setMonthlyBillAmountAction,
  toggleMonthlyTaskDoneAction,
  updateMonthlyTaskAction,
} from "@/app/(app)/tasks-actions";
import {
  MonthlyTaskEditForm,
  type MonthlyTaskEditValues,
} from "@/components/MonthlyTaskEditForm/MonthlyTaskEditForm";
import { parseKrInput } from "@/lib/monthly-finance";
import {
  formatMonthlyTaskDetail,
  groupByCategory,
  type MonthlyTaskForMonth,
  type TaskCategory,
} from "@/lib/tasks";
import { effectiveScheduledDay, formatBillAmountKr, effectiveBillAmountKr, isMonthlyBill } from "@/lib/monthly-bills";
import styles from "./monthly-tasks.module.scss";

interface Props {
  monthStart: string;
  tasks: MonthlyTaskForMonth[];
  categories: TaskCategory[];
}

export function MonthlyTasksBoard({
  monthStart,
  tasks,
  categories,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = (taskId: string, fn: () => Promise<{ ok: boolean; error?: string }>) => {
    setError(null);
    setPendingId(taskId);
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) setError(res.error ?? "Kunde inte uppdatera uppgiften.");
      setPendingId(null);
      router.refresh();
    });
  };

  const toggleQuick = (task: MonthlyTaskForMonth) => {
    if (task.completionKind === "finance") {
      document.getElementById("ekonomi")?.scrollIntoView({ behavior: "smooth" });
      setExpandedId(task.id);
      return;
    }
    if (task.completionKind === "amount") {
      setExpandedId(task.id);
      return;
    }
    run(task.id, () =>
      toggleMonthlyTaskDoneAction({
        taskId: task.id,
        monthStart,
        done: !task.completion?.doneAt,
        amount: isMonthlyBill(task, categories)
          ? effectiveBillAmountKr(task) ?? undefined
          : undefined,
      }),
    );
  };

  const completeSimple = (task: MonthlyTaskForMonth, note: string) =>
    run(task.id, async () => {
      const res = await toggleMonthlyTaskDoneAction({
        taskId: task.id,
        monthStart,
        done: true,
        note,
        amount: isMonthlyBill(task, categories)
          ? effectiveBillAmountKr(task) ?? undefined
          : undefined,
      });
      if (res.ok) setExpandedId(null);
      return res;
    });

  const completeAmount = (
    task: MonthlyTaskForMonth,
    amountRaw: string,
    note: string,
  ) => {
    const amount = parseKrInput(amountRaw);
    if (amount == null) {
      setError("Ange ett belopp.");
      return;
    }
    run(task.id, async () => {
      const res = await toggleMonthlyTaskDoneAction({
        taskId: task.id,
        monthStart,
        done: true,
        note,
        amount,
      });
      if (res.ok) setExpandedId(null);
      return res;
    });
  };

  const uncomplete = (task: MonthlyTaskForMonth) =>
    run(task.id, () =>
      toggleMonthlyTaskDoneAction({
        taskId: task.id,
        monthStart,
        done: false,
      }),
    );

  const scheduleDay = (task: MonthlyTaskForMonth, raw: string) => {
    const dayOfMonth = raw === "" ? null : Number(raw);
    if (dayOfMonth != null && (dayOfMonth < 1 || dayOfMonth > 31)) return;
    run(task.id, () =>
      scheduleMonthlyBillDayAction({
        taskId: task.id,
        monthStart,
        dayOfMonth,
      }),
    );
  };

  const changeCategory = (task: MonthlyTaskForMonth, raw: string) =>
    run(task.id, () =>
      updateMonthlyTaskAction({
        id: task.id,
        categoryId: raw || null,
      }),
    );

  const saveEdit = (taskId: string, values: MonthlyTaskEditValues, task: MonthlyTaskForMonth) =>
    run(taskId, async () => {
      const res = await updateMonthlyTaskAction({
        id: taskId,
        title: values.title,
        categoryId: values.categoryId,
        dayOfMonth: values.dayOfMonth,
        notes: values.notes,
        icon: values.icon,
        accent: values.accent,
        ...(isMonthlyBill(task, categories) || isMonthlyBill({ categoryId: values.categoryId }, categories)
          ? { defaultAmountKr: values.defaultAmountKr }
          : {}),
      });
      if (res.ok) {
        setEditingId(null);
        setExpandedId(null);
      }
      return res;
    });

  const saveBillAmount = (task: MonthlyTaskForMonth, amountRaw: string) => {
    const amount = parseKrInput(amountRaw);
    run(task.id, () =>
      setMonthlyBillAmountAction({
        taskId: task.id,
        monthStart,
        amountKr: amount,
      }),
    );
  };

  const removeTask = (taskId: string) =>
    run(taskId, async () => {
      const res = await archiveMonthlyTaskAction(taskId);
      if (res.ok) {
        setEditingId(null);
        setExpandedId(null);
      }
      return res;
    });

  if (tasks.length === 0) {
    return (
      <p className={styles.empty}>
        Inga månadsuppgifter ännu. Lägg till under{" "}
        <a href="/profile" className={styles.link}>
          profil
        </a>
        .
      </p>
    );
  }

  const grouped = groupByCategory(tasks, categories);
  const doneCount = tasks.filter((t) => t.completion?.doneAt).length;

  return (
    <div className={styles.board}>
      <div className={styles.progressLine}>
        <span className={styles.progressText}>
          <strong>{doneCount}</strong>
          <span className={styles.progressSlash}>/ {tasks.length}</span>
          <span className={styles.progressLabel}>klara den här månaden</span>
        </span>
        <div className={styles.progressBar} aria-hidden>
          <div
            className={styles.progressFill}
            style={{
              width: `${tasks.length === 0 ? 0 : Math.round((doneCount / tasks.length) * 100)}%`,
            }}
          />
        </div>
      </div>

      {error ? <p className={styles.error}>{error}</p> : null}

      {grouped.map(({ category, items }) => (
        <section
          key={category?.id ?? "uncategorized"}
          className={styles.group}
        >
          <header className={styles.groupHeader}>
            <span
              className={styles.groupChip}
              style={{
                borderColor: category?.accent ?? "transparent",
                color: category?.accent ?? undefined,
              }}
            >
              <span className={styles.groupIcon} aria-hidden>
                {category?.icon ?? "•"}
              </span>
              <span className={styles.groupName}>
                {category?.name ?? "Ingen kategori"}
              </span>
            </span>
            <span className={styles.groupCount}>
              {items.filter((t) => t.completion?.doneAt).length}/{items.length}
            </span>
          </header>

          <ul className={styles.taskList}>
            {items.map((t) => (
              <MonthlyTaskRow
                key={t.id}
                task={t}
                monthStart={monthStart}
                categories={categories}
                pending={pending}
                busy={pendingId === t.id}
                expanded={expandedId === t.id}
                editing={editingId === t.id}
                onToggleExpand={() => {
                  if (editingId === t.id) return;
                  setExpandedId(expandedId === t.id ? null : t.id);
                }}
                onStartEdit={() => {
                  setEditingId(t.id);
                  setExpandedId(t.id);
                }}
                onCancelEdit={() => setEditingId(null)}
                onSaveEdit={(values) => saveEdit(t.id, values, t)}
                onDelete={() => removeTask(t.id)}
                onToggleQuick={toggleQuick}
                onCompleteSimple={completeSimple}
                onCompleteAmount={completeAmount}
                onUncomplete={uncomplete}
                onSchedule={scheduleDay}
                onChangeCategory={changeCategory}
                onSaveBillAmount={saveBillAmount}
              />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

interface MonthlyTaskRowProps {
  task: MonthlyTaskForMonth;
  monthStart: string;
  categories: TaskCategory[];
  pending: boolean;
  busy: boolean;
  expanded: boolean;
  editing: boolean;
  onToggleExpand: () => void;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onSaveEdit: (values: MonthlyTaskEditValues) => void;
  onDelete: () => void;
  onToggleQuick: (task: MonthlyTaskForMonth) => void;
  onCompleteSimple: (task: MonthlyTaskForMonth, note: string) => void;
  onCompleteAmount: (
    task: MonthlyTaskForMonth,
    amountRaw: string,
    note: string,
  ) => void;
  onUncomplete: (task: MonthlyTaskForMonth) => void;
  onSchedule: (task: MonthlyTaskForMonth, raw: string) => void;
  onChangeCategory: (task: MonthlyTaskForMonth, raw: string) => void;
  onSaveBillAmount: (task: MonthlyTaskForMonth, amountRaw: string) => void;
}

function MonthlyTaskRow({
  task,
  monthStart,
  categories,
  pending,
  busy,
  expanded,
  editing,
  onToggleExpand,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onDelete,
  onToggleQuick,
  onCompleteSimple,
  onCompleteAmount,
  onUncomplete,
  onSchedule,
  onChangeCategory,
  onSaveBillAmount,
}: MonthlyTaskRowProps) {
  const done = Boolean(task.completion?.doneAt);
  const scheduledDay = effectiveScheduledDay(task, task.completion);
  const detail = formatMonthlyTaskDetail(task, task.completion);
  const billAmountLabel = formatBillAmountKr(task);
  const isBill = isMonthlyBill(task, categories);
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

  const showDayPicker = task.completionKind === "simple";

  return (
    <li
      className={[
        styles.task,
        done ? styles.taskDone : "",
        busy ? styles.taskBusy : "",
        task.singleMonthStart ? styles.taskOneOff : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <button
        type="button"
        className={[styles.checkBtn, done ? styles.checkBtnDone : ""]
          .filter(Boolean)
          .join(" ")}
        aria-label={done ? "Markera som ej klar" : "Markera som klar"}
        aria-pressed={done}
        disabled={pending}
        onClick={() => onToggleQuick(task)}
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
      <span className={styles.taskIcon} aria-hidden style={{ borderColor: task.accent }}>
        {task.icon}
      </span>
      <div className={styles.taskMeta}>
        <button
          type="button"
          className={styles.taskTitleBtn}
          onClick={onToggleExpand}
          aria-expanded={expanded}
          disabled={pending}
        >
          <span className={styles.taskTitle}>
            {task.title}
            {task.singleMonthStart ? (
              <span className={styles.oneOffBadge}>Engång</span>
            ) : null}
            {isBill && billAmountLabel ? (
              <span className={styles.billAmountBadge}>{billAmountLabel}</span>
            ) : null}
          </span>
          {detail && !isBill ? <span className={styles.taskNoteHint}>{detail}</span> : null}
          {isBill && done && detail ? (
            <span className={styles.taskNoteHint}>{detail}</span>
          ) : null}
          <span
            className={[styles.chevron, expanded ? styles.chevronUp : ""]
              .filter(Boolean)
              .join(" ")}
            aria-hidden
          >
            ▾
          </span>
        </button>
        {showDayPicker ? (
          <label className={styles.taskDay}>
            <span className={styles.taskDayLabel}>Dag</span>
            <select
              className={styles.taskDaySelect}
              value={scheduledDay ?? ""}
              disabled={pending}
              onChange={(e) => onSchedule(task, e.target.value)}
              aria-label={`Placera ${task.title} på dag i månaden`}
            >
              <option value="">Ej placerad</option>
              {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>

      {expanded ? (
        <div className={styles.expand}>
          {editing ? (
            <MonthlyTaskEditForm
              task={task}
              categories={categories}
              pending={pending}
              onSave={onSaveEdit}
              onDelete={onDelete}
              onCancel={onCancelEdit}
            />
          ) : (
            <>
          {categories.length > 0 ? (
            <label className={styles.taskDay}>
              <span className={styles.taskDayLabel}>Kategori</span>
              <select
                className={styles.taskDaySelect}
                value={task.categoryId ?? ""}
                disabled={pending}
                onChange={(e) => onChangeCategory(task, e.target.value)}
                aria-label={`Kategori för ${task.title}`}
              >
                <option value="">Ingen kategori</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.icon} {c.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

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
                onClick={() => onSaveBillAmount(task, billAmount)}
              >
                Spara kostnad
              </Button>
            </>
          ) : null}

          {task.completionKind === "finance" ? (
            <div className={styles.financeLinkBlock}>
              <p className={styles.financeLinkText}>
                Fyll i alla konton i ekonomitabellen ovan. LF-total och summa
                räknas ut automatiskt.
              </p>
              <a href="#ekonomi" className={styles.financeLink}>
                Gå till ekonomitabellen ↓
              </a>
              {done && detail ? (
                <p className={styles.noteReadout}>
                  <span className={styles.noteReadoutLabel}>Status</span>
                  {detail}
                </p>
              ) : null}
            </div>
          ) : !done ? (
            <>
              {task.completionKind === "amount" ? (
                <Input
                  label="Belopp (kr)"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="t.ex. 1500"
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
                onClick={() =>
                  task.completionKind === "amount"
                    ? onCompleteAmount(task, amount, note)
                    : onCompleteSimple(task, note)
                }
              >
                Markera klart
              </Button>
            </>
          ) : (
            <>
              {detail ? (
                <p className={styles.noteReadout}>
                  <span className={styles.noteReadoutLabel}>Detaljer</span>
                  {detail}
                </p>
              ) : (
                <p className={styles.noteEmpty}>Ingen kommentar.</p>
              )}
              <button
                type="button"
                className={styles.undoBtn}
                onClick={() => onUncomplete(task)}
                disabled={pending}
              >
                Ångra klarmarkering
              </button>
            </>
          )}

              <button
                type="button"
                className={styles.editTaskBtn}
                onClick={onStartEdit}
                disabled={pending}
              >
                Redigera uppgift
              </button>
            </>
          )}
        </div>
      ) : null}
    </li>
  );
}
