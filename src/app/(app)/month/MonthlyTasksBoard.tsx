"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/Input/Input";
import { Button } from "@/components/Button/Button";
import {
  archiveMonthlyTaskAction,
  copyMonthPlanFromPreviousAction,
  deleteMonthlyTaskInstanceAction,
  scheduleMonthlyTaskPlanAction,
  setMonthlyBillAmountAction,
  toggleMonthlyTaskDoneAction,
  updateMonthlyTaskAction,
} from "@/app/(app)/tasks-actions";
import {
  MonthlyTaskEditForm,
  type MonthlyTaskEditValues,
} from "@/components/MonthlyTaskEditForm/MonthlyTaskEditForm";
import {
  monthlyTaskDisplayTitle,
  parseKrInput,
  transferTaskFinanceLabel,
} from "@/lib/monthly-finance";
import {
  formatMonthlyTaskDetail,
  groupByCategory,
  expandMonthlyTaskOccurrences,
  isMonthlyTaskRepeatable,
  monthlyTaskCompletions,
  monthlyTaskInstanceKey,
  type MonthlyTaskForMonth,
  type TaskCategory,
} from "@/lib/tasks";
import { formatWeekLabel, parseLocalISO, weekStartISO } from "@/lib/date";
import {
  dateInMonth,
  formatBillAmountKr,
  effectiveBillAmountKr,
  isMonthlyBill,
  isMonthlyFinanceTask,
  isMonthlyAmountTask,
  isMonthlyTaskComplete,
  needsMonthPlacement,
  resolveMonthlyTaskSchedule,
  weeksInMonth,
} from "@/lib/monthly-bills";
import styles from "./monthly-tasks.module.scss";

interface Props {
  monthStart: string;
  tasks: MonthlyTaskForMonth[];
  categories: TaskCategory[];
  isFuturePlan?: boolean;
}

export function MonthlyTasksBoard({
  monthStart,
  tasks,
  categories,
  isFuturePlan = false,
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
    if (isMonthlyTaskRepeatable(task) && !task.completion?.isInstance) {
      setExpandedId(task.id);
      return;
    }
    if (isMonthlyFinanceTask(task)) {
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
        completionId: task.completion?.id,
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
        completionId: task.completion?.id,
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
        completionId: task.completion?.id,
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
        completionId: task.completion?.id,
      }),
    );

  const schedulePlan = (
    task: MonthlyTaskForMonth,
    weekStart: string | null,
    dayOfMonth: number | null,
    occasion?: string,
  ) => {
    if (dayOfMonth != null && (dayOfMonth < 1 || dayOfMonth > 31)) return;
    run(task.id, () =>
      scheduleMonthlyTaskPlanAction({
        taskId: task.id,
        monthStart,
        weekStart,
        dayOfMonth,
        occasion,
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

  const copyFromPrevious = () => {
    setError(null);
    startTransition(async () => {
      const res = await copyMonthPlanFromPreviousAction({ monthStart });
      if (!res.ok) setError(res.error ?? "Kunde inte kopiera planen.");
      router.refresh();
    });
  };

  if (tasks.length === 0) {
    return (
      <p className={styles.empty}>
        Inga månadsuppgifter ännu. Lägg till under{" "}
        <a href="/settings" className={styles.link}>
          inställningar
        </a>
        .
      </p>
    );
  }

  const removeInstance = (completionId: string) =>
    run(completionId, () => deleteMonthlyTaskInstanceAction({ completionId }));

  const toPlaceTasks = tasks.filter((t) =>
    needsMonthPlacement(t, t.completion, monthStart),
  );
  const plannedTasks = [
    ...tasks.filter(
      (t) =>
        !isMonthlyTaskRepeatable(t) &&
        !needsMonthPlacement(t, t.completion, monthStart),
    ),
    ...expandMonthlyTaskOccurrences(
      tasks.filter((t) => isMonthlyTaskRepeatable(t)),
    ),
  ];
  const groupedToPlace = groupByCategory(toPlaceTasks, categories);
  const groupedPlanned = groupByCategory(plannedTasks, categories);
  const doneCount = tasks.filter((t) =>
    isMonthlyTaskComplete(t, t.completion),
  ).length;
  const plannedCount = tasks.filter(
    (t) => !needsMonthPlacement(t, t.completion, monthStart),
  ).length;

  const renderTaskList = (
    items: MonthlyTaskForMonth[],
    allowUnplanFest = false,
  ) => (
    <ul className={styles.taskList}>
      {items.map((t) => {
        const rowKey = monthlyTaskInstanceKey(t);
        const canUnplanFest = allowUnplanFest && Boolean(t.completion?.id);
        return (
        <MonthlyTaskRow
          key={rowKey}
          task={t}
          monthStart={monthStart}
          categories={categories}
          pending={pending}
          busy={pendingId === rowKey || pendingId === t.id}
          expanded={expandedId === rowKey}
          editing={editingId === t.id}
          onToggleExpand={() => {
            if (editingId === t.id) return;
            setExpandedId(expandedId === rowKey ? null : rowKey);
          }}
          onStartEdit={() => {
            setEditingId(t.id);
            setExpandedId(rowKey);
          }}
          onCancelEdit={() => setEditingId(null)}
          onSaveEdit={(values) => saveEdit(t.id, values, t)}
          onDelete={
            t.singleMonthStart
              ? () => removeTask(t.id)
              : canUnplanFest
                ? () => removeInstance(t.completion!.id)
                : undefined
          }
          onToggleQuick={toggleQuick}
          onCompleteSimple={completeSimple}
          onCompleteAmount={completeAmount}
          onUncomplete={uncomplete}
          onSchedulePlan={schedulePlan}
          onRemoveInstance={removeInstance}
          onChangeCategory={changeCategory}
          onSaveBillAmount={saveBillAmount}
        />
        );
      })}
    </ul>
  );

  const renderGroupedSection = (
    grouped: { category: TaskCategory | null; items: MonthlyTaskForMonth[] }[],
    allowUnplanFest = false,
  ) =>
    grouped.map(({ category, items }) => (
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
            {items.filter((t) => isMonthlyTaskComplete(t, t.completion)).length}/{items.length}
          </span>
        </header>
        {renderTaskList(items, allowUnplanFest)}
      </section>
    ));

  return (
    <div className={styles.board}>
      {toPlaceTasks.length > 0 ? (
        <div className={styles.copyPlanRow}>
          <Button
            type="button"
            variant="outline"
            size="md"
            loading={pending}
            disabled={pending}
            onClick={copyFromPrevious}
          >
            Kopiera plan från förra månaden
          </Button>
        </div>
      ) : null}

      <div className={styles.progressLine}>
        <span className={styles.progressText}>
          <strong>{isFuturePlan ? plannedCount : doneCount}</strong>
          <span className={styles.progressSlash}>/ {tasks.length}</span>
          <span className={styles.progressLabel}>
            {isFuturePlan ? "planerade" : "klara den här månaden"}
          </span>
        </span>
        <div className={styles.progressBar} aria-hidden>
          <div
            className={styles.progressFill}
            style={{
              width: `${tasks.length === 0 ? 0 : Math.round(((isFuturePlan ? plannedCount : doneCount) / tasks.length) * 100)}%`,
            }}
          />
        </div>
      </div>

      {error ? <p className={styles.error}>{error}</p> : null}

      {toPlaceTasks.length > 0 ? (
        <section className={styles.planSection}>
          <header className={styles.planSectionHeader}>
            <h3 className={styles.planSectionTitle}>Att placera</h3>
            <span className={styles.planSectionCount}>{toPlaceTasks.length}</span>
          </header>
          {groupedToPlace.length > 0 ? (
            renderGroupedSection(groupedToPlace)
          ) : null}
        </section>
      ) : (
        <p className={styles.planSectionDone}>
          Alla uppgifter är planerade — klarmarkera eller gå till veckovyn.
        </p>
      )}

      {plannedTasks.length > 0 ? (
        <section className={styles.planSection}>
          <header className={styles.planSectionHeader}>
            <h3 className={styles.planSectionTitle}>Planerade</h3>
            <span className={styles.planSectionCount}>
              {plannedTasks.filter((t) => isMonthlyTaskComplete(t, t.completion)).length}/
              {plannedTasks.length} klara
            </span>
          </header>
          {renderGroupedSection(groupedPlanned, true)}
        </section>
      ) : null}
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
  onDelete?: () => void;
  onToggleQuick: (task: MonthlyTaskForMonth) => void;
  onCompleteSimple: (task: MonthlyTaskForMonth, note: string) => void;
  onCompleteAmount: (
    task: MonthlyTaskForMonth,
    amountRaw: string,
    note: string,
  ) => void;
  onUncomplete: (task: MonthlyTaskForMonth) => void;
  onSchedulePlan: (
    task: MonthlyTaskForMonth,
    weekStart: string | null,
    dayOfMonth: number | null,
    occasion?: string,
  ) => void;
  onRemoveInstance?: (completionId: string) => void;
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
  onSchedulePlan,
  onRemoveInstance,
  onChangeCategory,
  onSaveBillAmount,
}: MonthlyTaskRowProps) {
  const schedule = resolveMonthlyTaskSchedule(task, task.completion, monthStart);
  const monthWeeks = weeksInMonth(monthStart);
  const detail = formatMonthlyTaskDetail(task, task.completion);
  const billAmountLabel = formatBillAmountKr(task);
  const amountDetail = formatMonthlyTaskDetail(task, task.completion);
  const isBill = isMonthlyBill(task, categories);
  const displayTitle = monthlyTaskDisplayTitle(task, task.completion);
  const transferTarget = transferTaskFinanceLabel(task.key);
  const done = isMonthlyTaskComplete(task, task.completion);
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
  const [festOccasion, setFestOccasion] = useState("");
  const [festDay, setFestDay] = useState("");
  const [festHint, setFestHint] = useState<string | null>(null);

  const showDayPicker = !done;
  const isFestSource =
    isMonthlyTaskRepeatable(task) && !task.completion?.isInstance;
  const festOccasions = isFestSource
    ? monthlyTaskCompletions(task).filter(
        (c) =>
          !c.isUnscheduled &&
          (c.scheduledDayOfMonth != null || c.doneAt != null),
      )
    : [];

  const planSummary =
    done && schedule.isPlanned && schedule.weekStart
      ? schedule.dayOfMonth != null
        ? `${formatWeekLabel(schedule.weekStart)} · dag ${schedule.dayOfMonth}`
        : formatWeekLabel(schedule.weekStart)
      : null;

  const onWeekChange = (raw: string) => {
    const weekStart = raw === "" ? null : raw;
    if (weekStart == null) {
      onSchedulePlan(task, null, null);
      return;
    }
    let day: number | null = null;
    if (schedule.dayOfMonth != null) {
      const dayWeek = weekStartISO(
        parseLocalISO(dateInMonth(monthStart, schedule.dayOfMonth)),
      );
      if (dayWeek === weekStart) day = schedule.dayOfMonth;
    }
    onSchedulePlan(task, weekStart, day);
  };

  const onDayChange = (raw: string) => {
    const dayOfMonth = raw === "" ? null : Number(raw);
    if (dayOfMonth != null && (dayOfMonth < 1 || dayOfMonth > 31)) return;
    onSchedulePlan(
      task,
      dayOfMonth != null ? null : schedule.weekStart,
      dayOfMonth,
    );
  };

  return (
    <li
      className={[
        styles.task,
        done ? styles.taskDone : "",
        busy ? styles.taskBusy : "",
        task.singleMonthStart ? styles.taskOneOff : "",
        onDelete ? styles.taskWithRemove : "",
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
        disabled={pending || isFestSource}
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
      {onDelete ? (
        <button
          type="button"
          className={styles.taskRemoveBtn}
          onClick={onDelete}
          disabled={pending}
          aria-label={
            isMonthlyTaskRepeatable(task)
              ? `Avplanera ${displayTitle}`
              : `Ta bort ${task.title}`
          }
          title={isMonthlyTaskRepeatable(task) ? "Avplanera" : "Ta bort"}
        >
          ×
        </button>
      ) : null}
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
            {displayTitle}
            {task.singleMonthStart ? (
              <span className={styles.oneOffBadge}>Engång</span>
            ) : null}
            {transferTarget ? (
              <span className={styles.transferTargetBadge}>→ {transferTarget}</span>
            ) : null}
            {(isBill || isMonthlyAmountTask(task)) && billAmountLabel ? (
              <span className={styles.billAmountBadge}>{billAmountLabel}</span>
            ) : null}
          </span>
          {amountDetail && !isBill && !billAmountLabel ? (
            <span className={styles.taskNoteHint}>{amountDetail}</span>
          ) : isFestSource ? (
            <span className={styles.taskNoteHint}>
              Lägg till flera fester. Avplanera ett tillfälle med × under Planerade.
            </span>
          ) : detail && !isBill ? <span className={styles.taskNoteHint}>{detail}</span> : null}
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
        {isFestSource ? (
          <div className={styles.festAdd}>
            <Input
              label="Vilken slags fest?"
              value={festOccasion}
              onChange={(e) => {
                setFestOccasion(e.target.value);
                setFestHint(null);
              }}
              placeholder="t.ex. kräftskiva, födelsedag"
              maxLength={80}
              disabled={pending}
              error={festHint ?? undefined}
            />
            <div className={styles.taskPlanRow}>
              <label className={styles.taskDay}>
                <span className={styles.taskDayLabel}>Dag</span>
                <select
                  className={styles.taskDaySelect}
                  value={festDay}
                  disabled={pending}
                  onChange={(e) => setFestDay(e.target.value)}
                  aria-label={`Dag för ${task.title}`}
                >
                  <option value="">Välj dag…</option>
                  {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </label>
              <Button
                type="button"
                variant="outline"
                size="md"
                disabled={pending}
                onClick={() => {
                  const dayOfMonth = Number(festDay);
                  if (!festOccasion.trim()) {
                    setFestHint("Skriv vilken slags fest det är.");
                    return;
                  }
                  if (!festDay || dayOfMonth < 1 || dayOfMonth > 31) {
                    setFestHint("Välj en dag.");
                    return;
                  }
                  setFestHint(null);
                  onSchedulePlan(task, null, dayOfMonth, festOccasion);
                  setFestOccasion("");
                  setFestDay("");
                }}
              >
                Lägg till
              </Button>
            </div>
            {festOccasions.length > 0 ? (
              <ul className={styles.festList}>
                {festOccasions.map((c) => (
                  <li key={c.id} className={styles.festListItem}>
                    <span>
                      {c.occasion?.trim()
                        ? `${c.occasion.trim()} · dag ${c.scheduledDayOfMonth ?? "?"}`
                        : `Dag ${c.scheduledDayOfMonth ?? "?"}`}
                      {c.doneAt ? " · klar" : ""}
                    </span>
                    {onRemoveInstance ? (
                      <button
                        type="button"
                        className={styles.link}
                        disabled={pending}
                        onClick={() => onRemoveInstance(c.id)}
                      >
                        Avplanera
                      </button>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className={styles.taskPlanSummary}>
                Inga fester inlagda den här månaden ännu.
              </p>
            )}
          </div>
        ) : isMonthlyTaskRepeatable(task) ? (
          <p className={styles.taskPlanSummary}>
            {task.completion?.scheduledDayOfMonth != null
              ? `Dag ${task.completion.scheduledDayOfMonth}`
              : "Planerad"}
            {done ? " · klar" : ""}
          </p>
        ) : showDayPicker ? (
          <div className={styles.taskPlanRow}>
            <label className={styles.taskDay}>
              <span className={styles.taskDayLabel}>Vecka</span>
              <select
                className={styles.taskDaySelect}
                value={schedule.weekStart ?? ""}
                disabled={pending}
                onChange={(e) => onWeekChange(e.target.value)}
                aria-label={`Planera ${task.title} i vecka`}
              >
                <option value="">Ej planerad</option>
                {monthWeeks.map((w) => (
                  <option key={w} value={w}>
                    {formatWeekLabel(w)}
                  </option>
                ))}
              </select>
            </label>
            <label className={styles.taskDay}>
              <span className={styles.taskDayLabel}>Dag</span>
              <select
                className={styles.taskDaySelect}
                value={schedule.dayOfMonth ?? ""}
                disabled={pending}
                onChange={(e) => onDayChange(e.target.value)}
                aria-label={`Placera ${task.title} på dag i månaden`}
              >
                <option value="">Ingen specifik dag</option>
                {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </label>
          </div>
        ) : planSummary ? (
          <p className={styles.taskPlanSummary}>{planSummary}</p>
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
              {task.completionKind === "amount" && task.notes ? (
                <p className={styles.financeLinkText}>{task.notes}</p>
              ) : transferTarget ? (
                <p className={styles.financeLinkText}>
                  Beloppet läggs till på <strong>{transferTarget}</strong> i
                  ekonomitabellen.
                </p>
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

              {task.singleMonthStart && onDelete ? (
                <button
                  type="button"
                  className={styles.removeOneOffBtn}
                  onClick={onDelete}
                  disabled={pending}
                >
                  Ta bort engångsuppgift
                </button>
              ) : null}
            </>
          )}
        </div>
      ) : null}
    </li>
  );
}
