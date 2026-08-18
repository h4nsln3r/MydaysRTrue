"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { useDayReschedule } from "@/lib/use-day-reschedule";
import { useRouter } from "next/navigation";
import { Card } from "@/components/Card/Card";
import { Button } from "@/components/Button/Button";
import { Input } from "@/components/Input/Input";
import { MusicActivityFields } from "@/components/MusicActivityFields/MusicActivityFields";
import {
  completeWeeklyTaskAction,
  updateWeeklyTaskCompletionAction,
  createOneOffWeeklyTaskAction,
  deleteWeeklyTaskPlacementAction,
  moveWeeklyTaskPlacementAction,
  placeWeeklyTaskAction,
  setWeeklyTaskCategoryAction,
  toggleWeeklyTaskDoneAction,
  uncompleteWeeklyTaskAction,
  unplaceWeeklyTaskAction,
  setWeeklyTaskOnHoldAction,
} from "@/app/(app)/tasks-actions";
import {
  formatWeeklyTaskDetail,
  isCodingWeeklyTaskKey,
  isGameWeeklyTaskKey,
  isWeeklyTaskRepeatable,
  musicActivityCreatesGig,
  musicActivityCreatesLiveEvent,
  musicSessionIcon,
  musicSessionTitle,
  parseMusicActivity,
  sortWeeklyDayTasks,
  type MusicActivity,
  WEEKDAY_LONG,
  WEEKDAY_SHORT,
  WEEKDAYS,
  type TaskCategory,
  type Weekday,
  type WeeklyTaskForWeek,
} from "@/lib/tasks";
import type { CodingProject } from "@/lib/coding";
import { createCodingProjectAction } from "@/app/(app)/coding-actions";
import {
  formatKr,
  parseShopAmountExpr,
  shopAmountExprHasBreakdown,
} from "@/lib/monthly-finance";
import { GIG_RATING_MAX, GIG_RATING_MIN } from "@/lib/gigs";
import { ActivityCategoryBadge } from "@/components/ActivityCategoryBadge/ActivityCategoryBadge";
import { PlanCadenceBadge } from "@/components/PlanCadenceBadge/PlanCadenceBadge";
import { taskCategory } from "@/lib/activity-category";
import { isoWeekdayFromLocalISO } from "@/lib/date";
import type { RescheduleDay } from "@/lib/use-day-reschedule";
import { TrainingRescheduleSelect } from "@/components/DayActivitiesCard/TrainingRescheduleSelect";
import styles from "./WeeklyTasksDayCard.module.scss";

interface Props {
  weekStart: string;
  tasks: WeeklyTaskForWeek[];
  onHoldTasks?: WeeklyTaskForWeek[];
  categories: TaskCategory[];
  /** The day this card represents (YYYY-MM-DD). */
  date?: string;
  /** The user's current local day (YYYY-MM-DD). */
  today?: string;
  title?: string;
  hideWhenEmpty?: boolean;
  showWeekLink?: boolean;
  /** Show a quick "add a task for this week only" affordance. */
  enableQuickAdd?: boolean;
}

export function WeeklyTasksDayCard({
  weekStart,
  tasks,
  onHoldTasks = [],
  categories,
  date,
  today,
  title = "Veckouppgifter",
  hideWhenEmpty = false,
  showWeekLink = true,
  enableQuickAdd = false,
}: Props) {
  const router = useRouter();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const { isOverdue, canReschedule, rescheduleDays } = useDayReschedule({
    date,
    today,
    weekStart,
  });

  const quickAddWeekday =
    enableQuickAdd && date != null
      ? (isoWeekdayFromLocalISO(date) as Weekday)
      : null;
  const quickAdd =
    quickAddWeekday != null ? (
      <WeeklyTaskQuickAdd
        weekStart={weekStart}
        weekday={quickAddWeekday}
        categories={categories}
        onAdded={() => router.refresh()}
      />
    ) : null;

  const doneCount = tasks.filter((t) => t.placement?.doneAt).length;
  const orderedTasks = sortWeeklyDayTasks(tasks);

  if (tasks.length === 0) {
    if (hideWhenEmpty && onHoldTasks.length === 0) {
      if (!quickAdd) return null;
      return <Card className={styles.card}>{quickAdd}</Card>;
    }

    return (
      <Card className={styles.card}>
        {tasks.length === 0 ? (
          <p className={styles.empty}>Inga veckouppgifter planerade idag.</p>
        ) : null}
        {quickAdd}
        <WeeklyOnHoldSection
          tasks={onHoldTasks}
          weekStart={weekStart}
          categories={categories}
          onDone={() => router.refresh()}
        />
        {showWeekLink ? (
          <Link
            href={`/week?start=${weekStart}&view=plan`}
            className={styles.weekLink}
          >
            Se veckoplan →
          </Link>
        ) : null}
      </Card>
    );
  }

  return (
    <Card className={styles.card}>
      <header className={styles.header}>
        <div className={styles.titleRow}>
          <h2 className={styles.title}>{title}</h2>
          <span
            className={[
              styles.counter,
              doneCount === tasks.length ? styles.counterDone : "",
              doneCount > 0 && doneCount < tasks.length
                ? styles.counterPartial
                : "",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            <span className={styles.counterBig}>{doneCount}</span>
            <span className={styles.counterSlash}>/ {tasks.length}</span>
          </span>
        </div>
        {showWeekLink ? (
          <Link
            href={`/week?start=${weekStart}&view=plan`}
            className={styles.weekLink}
          >
            Veckoplan →
          </Link>
        ) : null}
      </header>

      {error ? <p className={styles.error}>{error}</p> : null}

      <ul className={styles.list}>
        {orderedTasks.map((task) => (
          <WeeklyTaskRow
            key={task.placement?.id ?? task.id}
            task={task}
            weekStart={weekStart}
            categories={categories}
            canReschedule={canReschedule}
            isOverdue={isOverdue}
            rescheduleDays={rescheduleDays}
            expanded={expandedId === (task.placement?.id ?? task.id)}
            busy={pendingId === (task.placement?.id ?? task.id)}
            pending={pending}
            onToggleExpand={() => {
              const id = task.placement?.id ?? task.id;
              setExpandedId(expandedId === id ? null : id);
            }}
            onError={setError}
            onPendingId={(id) =>
              setPendingId(id ? (task.placement?.id ?? task.id) : null)
            }
            onRefresh={() => router.refresh()}
            onDone={() => {
              setExpandedId(null);
              router.refresh();
            }}
            localDate={date}
          />
        ))}
      </ul>
      {quickAdd}
      <WeeklyOnHoldSection
        tasks={onHoldTasks}
        weekStart={weekStart}
        categories={categories}
        onDone={() => router.refresh()}
      />
    </Card>
  );
}

interface QuickAddRowProps {
  weekStart: string;
  weekday: Weekday;
  categories: TaskCategory[];
  onAdded: () => void;
}

export function WeeklyTaskQuickAdd({
  weekStart,
  weekday,
  categories,
  onAdded,
}: QuickAddRowProps) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const submit = () => {
    const trimmed = title.trim();
    if (!trimmed) return;
    setError(null);
    const cat = categories.find((c) => c.id === categoryId) ?? null;
    startTransition(async () => {
      const res = await createOneOffWeeklyTaskAction({
        title: trimmed,
        weekStart,
        weekday,
        categoryId: categoryId || null,
        accent: cat?.accent,
      });
      if (!res.ok) {
        setError(res.error ?? "Kunde inte lägga till.");
        return;
      }
      setTitle("");
      setCategoryId("");
      setOpen(false);
      onAdded();
    });
  };

  if (!open) {
    return (
      <button
        type="button"
        className={styles.quickAddToggle}
        onClick={() => setOpen(true)}
      >
        + Lägg till uppgift (bara denna vecka)
      </button>
    );
  }

  return (
    <div className={styles.quickAdd}>
      {error ? <p className={styles.error}>{error}</p> : null}
      <Input
        label="Uppgift"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="t.ex. Extra kodning"
        maxLength={80}
        disabled={pending}
        autoFocus
      />
      {categories.length > 0 ? (
        <label className={styles.categoryField}>
          <span className={styles.categoryFieldLabel}>Kategori</span>
          <select
            className={styles.categorySelect}
            value={categoryId}
            disabled={pending}
            onChange={(e) => setCategoryId(e.target.value)}
            aria-label="Kategori för uppgiften"
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
      <div className={styles.quickAddActions}>
        <button
          type="button"
          className={styles.quickAddCancel}
          onClick={() => {
            setOpen(false);
            setTitle("");
            setError(null);
          }}
          disabled={pending}
        >
          Avbryt
        </button>
        <Button
          type="button"
          variant="primary"
          size="md"
          loading={pending}
          disabled={pending || !title.trim()}
          onClick={submit}
        >
          Lägg till
        </Button>
      </div>
    </div>
  );
}

interface TaskRowProps {
  task: WeeklyTaskForWeek;
  weekStart: string;
  categories: TaskCategory[];
  codingProjects?: CodingProject[];
  canReschedule: boolean;
  isOverdue: boolean;
  rescheduleDays: RescheduleDay[];
  expanded: boolean;
  busy: boolean;
  pending: boolean;
  onToggleExpand: () => void;
  onError: (msg: string | null) => void;
  onPendingId: (id: string | null) => void;
  onRefresh: () => void;
  onDone: () => void;
  dragHandle?: React.ReactNode;
  sortableRef?: (node: HTMLElement | null) => void;
  sortableStyle?: React.CSSProperties;
  planningMode?: boolean;
  localDate?: string;
}

export function WeeklyTaskRow({
  task,
  weekStart,
  categories,
  codingProjects = [],
  canReschedule,
  isOverdue,
  rescheduleDays,
  expanded,
  busy,
  pending,
  onToggleExpand,
  onError,
  onPendingId,
  onRefresh,
  onDone,
  dragHandle,
  sortableRef,
  sortableStyle,
  planningMode = false,
  localDate,
}: TaskRowProps) {
  const placement = task.placement;
  const placementId = placement?.id;
  const isCoding = isCodingWeeklyTaskKey(task.key);
  const isGame = isGameWeeklyTaskKey(task.key);
  const done = Boolean(placement?.doneAt);
  // Quick tasks complete with one tap on the circle; everything is still
  // expandable so any task can carry an optional comment.
  const isQuickToggle =
    task.completionKind === "simple" || task.completionKind === "note";
  const needsExpand = true;
  const showReschedule = !planningMode && canReschedule && !done;
  const showPause =
    !planningMode &&
    !done &&
    task.singleWeekStart != null &&
    !placement?.onHold;
  const showRescheduleRow = showReschedule || showPause;
  const [, startTransition] = useTransition();

  const [taskNote, setTaskNote] = useState(placement?.note ?? "");
  const [shopLocation, setShopLocation] = useState(
    placement?.shopLocation ?? "",
  );
  const [shopAmount, setShopAmount] = useState(
    placement?.shopAmountExpr?.trim() ||
      (placement?.shopAmount != null ? String(placement.shopAmount) : ""),
  );
  const shopAmountParsed = parseShopAmountExpr(shopAmount);
  const shopAmountHint =
    shopAmountParsed && shopAmountExprHasBreakdown(shopAmountParsed.expression)
      ? `Totalt ${formatKr(shopAmountParsed.total)}`
      : undefined;
  const [laundryLoads, setLaundryLoads] = useState(
    placement?.laundryLoads != null ? String(placement.laundryLoads) : "",
  );
  const [band, setBand] = useState<string | null>(placement?.band ?? null);
  const [musicActivity, setMusicActivity] = useState<MusicActivity | null>(
    parseMusicActivity(placement?.musicActivity),
  );
  const [musicTitle, setMusicTitle] = useState(
    placement?.musicLogKind ? (placement.note ?? "") : "",
  );
  const [musicPlace, setMusicPlace] = useState("");
  const [musicRating, setMusicRating] = useState("");
  const [codingProjectId, setCodingProjectId] = useState(
    placement?.codingProjectId ?? "",
  );
  const [newProjectTitle, setNewProjectTitle] = useState("");
  const [creatingProject, setCreatingProject] = useState(false);
  const isLoggedMusicEvent =
    task.completionKind === "music" &&
    (musicActivityCreatesGig(musicActivity) ||
      musicActivityCreatesLiveEvent(musicActivity) ||
      Boolean(placement?.musicLogKind));

  useEffect(() => {
    setTaskNote(
      placement?.musicLogKind ? "" : (placement?.note ?? ""),
    );
    setShopLocation(placement?.shopLocation ?? "");
    setShopAmount(
      placement?.shopAmountExpr?.trim() ||
        (placement?.shopAmount != null ? String(placement.shopAmount) : ""),
    );
    setLaundryLoads(
      placement?.laundryLoads != null ? String(placement.laundryLoads) : "",
    );
    setBand(placement?.band ?? null);
    setMusicActivity(parseMusicActivity(placement?.musicActivity));
    setMusicTitle(placement?.musicLogKind ? (placement.note ?? "") : "");
    setCodingProjectId(placement?.codingProjectId ?? "");
  }, [
    placement?.note,
    placement?.shopLocation,
    placement?.shopAmount,
    placement?.shopAmountExpr,
    placement?.laundryLoads,
    placement?.band,
    placement?.musicActivity,
    placement?.musicLogKind,
    placement?.codingProjectId,
  ]);

  const detail = placement ? formatWeeklyTaskDetail(placement) : null;
  const planNote = placement?.planNote?.trim() ?? "";
  const category = taskCategory(task, categories);

  const toggleSimple = () => {
    onError(null);
    onPendingId(task.id);
    startTransition(async () => {
      const res = await toggleWeeklyTaskDoneAction({
        taskId: task.id,
        weekStart,
        done: !done,
      });
      if (!res.ok) onError(res.error ?? "Kunde inte uppdatera.");
      onPendingId(null);
      onDone();
    });
  };

  const complete = () => {
    onError(null);
    onPendingId(task.id);
    startTransition(async () => {
      const res = await completeWeeklyTaskAction({
        taskId: task.id,
        weekStart,
        placementId,
        note: taskNote,
        shopLocation,
        shopAmountExpr: shopAmount,
        laundryLoads:
          laundryLoads.trim() === "" ? undefined : Number(laundryLoads),
        band: band ?? undefined,
        musicActivity,
        musicTitle:
          musicActivityCreatesGig(musicActivity) ||
          musicActivityCreatesLiveEvent(musicActivity)
            ? musicTitle
            : undefined,
        musicPlace:
          musicActivityCreatesGig(musicActivity) ||
          musicActivityCreatesLiveEvent(musicActivity)
            ? musicPlace
            : undefined,
        musicRating:
          (musicActivityCreatesGig(musicActivity) ||
            musicActivityCreatesLiveEvent(musicActivity)) &&
          musicRating.trim() !== ""
            ? Number(musicRating)
            : null,
        codingProjectId: isCoding ? codingProjectId || null : undefined,
      });
      if (!res.ok) onError(res.error ?? "Kunde inte spara.");
      onPendingId(null);
      onDone();
    });
  };

  const saveCompletion = () => {
    onError(null);
    onPendingId(task.id);
    startTransition(async () => {
      const res = await updateWeeklyTaskCompletionAction({
        taskId: task.id,
        weekStart,
        placementId,
        note: isLoggedMusicEvent ? undefined : taskNote,
        shopLocation,
        shopAmountExpr: shopAmount,
        laundryLoads:
          laundryLoads.trim() === "" ? undefined : Number(laundryLoads),
        musicTitle: isLoggedMusicEvent ? musicTitle : undefined,
      });
      if (!res.ok) onError(res.error ?? "Kunde inte spara.");
      onPendingId(null);
      onRefresh();
    });
  };

  const uncomplete = () => {
    onError(null);
    onPendingId(task.id);
    startTransition(async () => {
      const res = await uncompleteWeeklyTaskAction({
        taskId: task.id,
        weekStart,
        placementId,
      });
      if (!res.ok) onError(res.error ?? "Kunde inte ångra.");
      setTaskNote("");
      setShopLocation("");
      setShopAmount("");
      setLaundryLoads("");
      setBand(null);
      setMusicActivity(null);
      setMusicTitle("");
      setMusicPlace("");
      setMusicRating("");
      setCodingProjectId("");
      setNewProjectTitle("");
      setCreatingProject(false);
      onPendingId(null);
      onDone();
    });
  };

  const createProject = () => {
    const title = newProjectTitle.trim();
    if (!title) {
      onError("Skriv ett projektnamn.");
      return;
    }
    onError(null);
    onPendingId(task.id);
    startTransition(async () => {
      const res = await createCodingProjectAction({ title });
      if (!res.ok || !res.id) {
        onError(res.error ?? "Kunde inte skapa projekt.");
        onPendingId(null);
        return;
      }
      setCodingProjectId(res.id);
      setNewProjectTitle("");
      setCreatingProject(false);
      onPendingId(null);
      onRefresh();
    });
  };

  const reschedule = (value: string) => {
    if (!value) return;
    onError(null);
    onPendingId(task.id);
    startTransition(async () => {
      const res =
        value === "remove"
          ? placementId && isWeeklyTaskRepeatable(task)
            ? await deleteWeeklyTaskPlacementAction({
                placementId,
                weekStart,
              })
            : await unplaceWeeklyTaskAction({ taskId: task.id, weekStart })
          : placementId && isWeeklyTaskRepeatable(task)
            ? await moveWeeklyTaskPlacementAction({
                placementId,
                weekStart,
                weekday: Number(value) as Weekday,
              })
            : await placeWeeklyTaskAction({
                taskId: task.id,
                weekStart,
                weekday: Number(value) as Weekday,
              });
      if (!res.ok) onError(res.error ?? "Kunde inte planera om.");
      onPendingId(null);
      onDone();
    });
  };

  const changeCategory = (value: string) => {
    onError(null);
    onPendingId(task.id);
    startTransition(async () => {
      const res = await setWeeklyTaskCategoryAction({
        taskId: task.id,
        categoryId: value || null,
      });
      if (!res.ok) onError(res.error ?? "Kunde inte byta kategori.");
      onPendingId(null);
      onRefresh();
    });
  };

  const pauseTask = () => {
    onError(null);
    onPendingId(task.id);
    startTransition(async () => {
      const res = await setWeeklyTaskOnHoldAction({
        taskId: task.id,
        weekStart,
        onHold: true,
      });
      if (!res.ok) onError(res.error ?? "Kunde inte pausa.");
      onPendingId(null);
      onDone();
    });
  };

  const savedNote = placement?.musicLogKind ? "" : (placement?.note ?? "");
  const savedMusicTitle = placement?.musicLogKind ? (placement.note ?? "") : "";
  const savedShopLocation = placement?.shopLocation ?? "";
  const savedShopAmount =
    placement?.shopAmountExpr?.trim() ||
    (placement?.shopAmount != null ? String(placement.shopAmount) : "");
  const savedLoads =
    placement?.laundryLoads != null ? String(placement.laundryLoads) : "";
  const completionDirty =
    done &&
    (taskNote !== savedNote ||
      shopLocation !== savedShopLocation ||
      shopAmount !== savedShopAmount ||
      laundryLoads !== savedLoads ||
      musicTitle !== savedMusicTitle);

  return (
    <li
      ref={sortableRef}
      style={sortableStyle}
      className={[
        styles.task,
        dragHandle ? styles.taskDraggable : "",
        done ? styles.taskDone : "",
        showReschedule && isOverdue ? styles.taskOverdue : "",
        busy ? styles.taskBusy : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <PlanCadenceBadge cadence="weekly" done={done} corner />
      {dragHandle}
      {isQuickToggle ? (
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
      ) : (
        <button
          type="button"
          className={[styles.checkBtn, done ? styles.checkBtnDone : ""]
            .filter(Boolean)
            .join(" ")}
          aria-label={done ? "Klart" : "Logga"}
          onClick={planningMode ? undefined : onToggleExpand}
          disabled={pending || planningMode}
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
      )}

      <button
        type="button"
        className={styles.taskBody}
        onClick={planningMode ? undefined : needsExpand ? onToggleExpand : undefined}
        aria-expanded={planningMode ? undefined : needsExpand ? expanded : undefined}
        disabled={pending || planningMode || !needsExpand}
      >
        <span
          className={styles.taskIcon}
          aria-hidden
          style={{ borderColor: task.accent }}
        >
          {musicSessionIcon(task, placement)}
        </span>
        <span className={styles.taskMeta}>
          {category ? (
            <ActivityCategoryBadge
              icon={category.icon}
              label={category.label}
              accent={category.accent}
              done={done}
            />
          ) : null}
          <span className={styles.taskTitle}>{musicSessionTitle(task, placement)}</span>
          {detail ? (
            <span className={styles.taskDetail}>{detail}</span>
          ) : !done && planNote && task.completionKind === "journal" ? (
            <span className={styles.planHint}>Planerat: {planNote}</span>
          ) : !done && planNote && task.completionKind === "laundry" ? (
            <span className={styles.planHint}>Bokad: {planNote}</span>
          ) : !done && planNote && task.completionKind === "music" ? (
            <span className={styles.planHint}>{planNote}</span>
          ) : !done && placement?.planTodo && task.completionKind === "music" ? (
            <span className={styles.planHint}>{placement.planTodo}</span>
          ) : null}
        </span>
        {needsExpand && !planningMode ? (
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

      {showRescheduleRow ? (
        <div className={styles.reschedule}>
          {showPause ? (
            <button
              type="button"
              className={styles.pauseBtn}
              onClick={pauseTask}
              disabled={pending}
            >
              ⏸ Pausa uppgift
            </button>
          ) : null}
          {showReschedule ? (
            <TrainingRescheduleSelect
              isOverdue={isOverdue}
              days={rescheduleDays}
              pending={pending}
              onSelect={reschedule}
            />
          ) : null}
        </div>
      ) : null}

      {expanded && needsExpand && !planningMode ? (
        <div className={styles.taskActions}>
          {task.completionKind === "journal" && planNote ? (
            <p className={styles.planReadout}>
              <span className={styles.planReadoutLabel}>Planerat</span>
              {planNote}
            </p>
          ) : null}
          {task.completionKind === "laundry" && planNote ? (
            <p className={styles.planReadout}>
              <span className={styles.planReadoutLabel}>Bokad tid</span>
              {planNote}
            </p>
          ) : null}
          {task.completionKind === "music" && placement?.planTodo ? (
            <p className={styles.planReadout}>
              <span className={styles.planReadoutLabel}>Uppgift</span>
              {placement.planTodo}
            </p>
          ) : null}
          {task.completionKind === "music" && planNote ? (
            <p className={styles.planReadout}>
              <span className={styles.planReadoutLabel}>Anteckning</span>
              {planNote}
            </p>
          ) : null}

          {task.completionKind === "shop" || task.completionKind === "expense" ? (
            <>
              <Input
                label={
                  task.completionKind === "expense"
                    ? "Vad gällde utgiften?"
                    : "Var handlade du?"
                }
                value={shopLocation}
                onChange={(e) => setShopLocation(e.target.value)}
                placeholder={
                  task.completionKind === "expense"
                    ? "t.ex. Netflix, bensin, kläder"
                    : "t.ex. ICA, Coop"
                }
                maxLength={120}
                disabled={pending}
              />
              <Input
                label="Summa (kr)"
                inputMode="decimal"
                value={shopAmount}
                onChange={(e) => setShopAmount(e.target.value)}
                placeholder="t.ex. 450 eller 45+120+8,50"
                hint={shopAmountHint}
                disabled={pending}
              />
            </>
          ) : null}
          {task.completionKind === "journal" ? (
            <>
              {isCoding && !done ? (
                <div className={styles.bandPicker}>
                  <span className={styles.bandLabel}>Projekt</span>
                  {creatingProject ? (
                    <div className={styles.quickAddActions}>
                      <Input
                        label="Nytt projekt"
                        value={newProjectTitle}
                        onChange={(e) => setNewProjectTitle(e.target.value)}
                        placeholder="t.ex. Mydays, Portfolio"
                        maxLength={120}
                        disabled={pending}
                      />
                      <button
                        type="button"
                        className={styles.quickAddCancel}
                        onClick={() => {
                          setCreatingProject(false);
                          setNewProjectTitle("");
                        }}
                        disabled={pending}
                      >
                        Avbryt
                      </button>
                      <Button
                        type="button"
                        variant="outline"
                        size="md"
                        loading={pending && busy}
                        disabled={pending || !newProjectTitle.trim()}
                        onClick={createProject}
                      >
                        Skapa
                      </Button>
                    </div>
                  ) : (
                    <>
                      <select
                        className={styles.rescheduleSelect}
                        value={codingProjectId}
                        disabled={pending}
                        onChange={(e) => {
                          if (e.target.value === "__new__") {
                            setCreatingProject(true);
                            return;
                          }
                          setCodingProjectId(e.target.value);
                        }}
                      >
                        <option value="">Välj projekt…</option>
                        {codingProjects.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.title}
                          </option>
                        ))}
                        {codingProjectId &&
                        !codingProjects.some((p) => p.id === codingProjectId) &&
                        placement?.codingProjectTitle ? (
                          <option value={codingProjectId}>
                            {placement.codingProjectTitle}
                          </option>
                        ) : null}
                        <option value="__new__">+ Nytt projekt</option>
                      </select>
                    </>
                  )}
                </div>
              ) : null}
              {isCoding && done && placement?.codingProjectTitle ? (
                <p className={styles.planReadout}>
                  <span className={styles.planReadoutLabel}>Projekt</span>
                  {placement.codingProjectTitle}
                </p>
              ) : null}
              <Input
                label={
                  isCoding
                    ? "Vad gjorde du i projektet?"
                    : isGame
                      ? "Hur gick sessionen?"
                      : "Vad gjorde du?"
                }
                value={taskNote}
                onChange={(e) => setTaskNote(e.target.value)}
                placeholder={
                  isCoding
                    ? "t.ex. Byggde repeatable tasks"
                    : isGame
                      ? "t.ex. kampanj, vad som hände, vilka som spelade"
                      : "Anteckna resultatet"
                }
                maxLength={500}
                disabled={pending}
              />
            </>
          ) : null}
          {task.completionKind === "simple" ||
          task.completionKind === "note" ||
          task.completionKind === "shop" ||
          task.completionKind === "expense" ||
          task.completionKind === "laundry" ? (
            <Input
              label="Kommentar (valfritt)"
              value={taskNote}
              onChange={(e) => setTaskNote(e.target.value)}
              placeholder="Skriv en kommentar"
              maxLength={500}
              disabled={pending}
            />
          ) : null}
          {task.completionKind === "laundry" ? (
            <Input
              label="Antal tvättar"
              type="number"
              inputMode="numeric"
              value={laundryLoads}
              onChange={(e) => setLaundryLoads(e.target.value)}
              placeholder="t.ex. 2"
              disabled={pending}
            />
          ) : null}
          {task.completionKind === "music" ? (
            <>
              {!done ? (
                <MusicActivityFields
                  activity={musicActivity}
                  onActivityChange={setMusicActivity}
                  band={band}
                  onBandChange={setBand}
                  disabled={pending}
                />
              ) : null}
              {!done &&
              (musicActivityCreatesGig(musicActivity) ||
                musicActivityCreatesLiveEvent(musicActivity)) ? (
                <>
                  <Input
                    label="Titel"
                    value={musicTitle}
                    onChange={(e) => setMusicTitle(e.target.value)}
                    placeholder={
                      musicActivityCreatesGig(musicActivity)
                        ? "t.ex. Ekenäsfestivalen, Kvarteret"
                        : "t.ex. Artist / band på scen"
                    }
                    maxLength={120}
                    disabled={pending}
                  />
                  <Input
                    label="Plats (valfritt)"
                    value={musicPlace}
                    onChange={(e) => setMusicPlace(e.target.value)}
                    placeholder={
                      musicActivityCreatesGig(musicActivity)
                        ? "t.ex. Debaser, Malmö"
                        : "t.ex. Annexet, Stockholm"
                    }
                    maxLength={120}
                    disabled={pending}
                  />
                  <Input
                    label="Kommentar (valfritt)"
                    value={taskNote}
                    onChange={(e) => setTaskNote(e.target.value)}
                    placeholder={
                      musicActivityCreatesGig(musicActivity)
                        ? "t.ex. Bra publik, lite nervös i början"
                        : "t.ex. Fantastisk stämning, bra setlista!"
                    }
                    maxLength={280}
                    disabled={pending}
                  />
                  <label className={styles.ratingField}>
                    <span className={styles.ratingLabel}>Betyg</span>
                    <select
                      className={styles.ratingSelect}
                      value={musicRating}
                      onChange={(e) => setMusicRating(e.target.value)}
                      disabled={pending}
                    >
                      <option value="">–</option>
                      {Array.from(
                        { length: GIG_RATING_MAX - GIG_RATING_MIN + 1 },
                        (_, i) => GIG_RATING_MIN + i,
                      ).map((n) => (
                        <option key={n} value={n}>
                          {n}/10
                        </option>
                      ))}
                    </select>
                  </label>
                </>
              ) : null}
              {done && isLoggedMusicEvent ? (
                <Input
                  label="Titel"
                  value={musicTitle}
                  onChange={(e) => setMusicTitle(e.target.value)}
                  placeholder="Titel"
                  maxLength={120}
                  disabled={pending}
                />
              ) : null}
              {(done && !isLoggedMusicEvent) ||
              (!done &&
                !musicActivityCreatesGig(musicActivity) &&
                !musicActivityCreatesLiveEvent(musicActivity)) ? (
                <Input
                  label="Kommentar (valfritt)"
                  value={taskNote}
                  onChange={(e) => setTaskNote(e.target.value)}
                  placeholder="Vad gjorde du?"
                  maxLength={500}
                  disabled={pending}
                />
              ) : null}
            </>
          ) : null}
          {!done ? (
            <Button
              type="button"
              variant="primary"
              size="md"
              fullWidth
              loading={pending && busy}
              disabled={pending}
              onClick={complete}
            >
              Markera klart
            </Button>
          ) : (
            <>
              {completionDirty ? (
                <Button
                  type="button"
                  variant="outline"
                  size="md"
                  fullWidth
                  loading={pending && busy}
                  disabled={pending}
                  onClick={saveCompletion}
                >
                  Spara
                </Button>
              ) : null}
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

          {categories.length > 0 ? (
            <label className={styles.categoryField}>
              <span className={styles.categoryFieldLabel}>Kategori</span>
              <select
                className={styles.categorySelect}
                value={task.categoryId ?? ""}
                disabled={pending}
                onChange={(e) => changeCategory(e.target.value)}
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
        </div>
      ) : null}
    </li>
  );
}

interface OnHoldSectionProps {
  tasks: WeeklyTaskForWeek[];
  weekStart: string;
  categories: TaskCategory[];
  onDone: () => void;
}

export function WeeklyOnHoldSection({
  tasks,
  weekStart,
  categories,
  onDone,
}: OnHoldSectionProps) {
  if (tasks.length === 0) return null;

  return (
    <section className={styles.onHoldSection}>
      <header className={styles.onHoldHeader}>
        <div>
          <h3 className={styles.onHoldTitle}>På paus</h3>
          <p className={styles.onHoldSub}>Engångsuppgifter som väntar</p>
        </div>
        <span className={styles.onHoldCount}>{tasks.length}</span>
      </header>
      <ul className={styles.onHoldList}>
        {tasks.map((task) => (
          <WeeklyOnHoldTaskRow
            key={task.id}
            task={task}
            weekStart={weekStart}
            category={taskCategory(task, categories)}
            onDone={onDone}
          />
        ))}
      </ul>
    </section>
  );
}

interface OnHoldTaskRowProps {
  task: WeeklyTaskForWeek;
  weekStart: string;
  category: ReturnType<typeof taskCategory>;
  onDone: () => void;
}

function WeeklyOnHoldTaskRow({
  task,
  weekStart,
  category,
  onDone,
}: OnHoldTaskRowProps) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const placeFromHold = (value: string) => {
    if (!value) return;
    setError(null);
    startTransition(async () => {
      const res =
        value === "resume"
          ? await setWeeklyTaskOnHoldAction({
              taskId: task.id,
              weekStart,
              onHold: false,
            })
          : await placeWeeklyTaskAction({
              taskId: task.id,
              weekStart,
              weekday: Number(value) as Weekday,
            });
      if (!res.ok) setError(res.error ?? "Kunde inte uppdatera.");
      onDone();
    });
  };

  return (
    <li className={styles.onHoldRow}>
      <span
        className={styles.taskIcon}
        aria-hidden
        style={{ borderColor: task.accent }}
      >
        {task.icon}
      </span>
      <span className={styles.onHoldMeta}>
        <span className={styles.taskTitle}>
          {task.title}
          <span className={styles.oneOffBadge}>Engång</span>
        </span>
        {category ? (
          <ActivityCategoryBadge
            icon={category.icon}
            label={category.label}
            accent={category.accent}
          />
        ) : null}
        {error ? <span className={styles.error}>{error}</span> : null}
      </span>
      <select
        className={styles.onHoldSelect}
        value=""
        disabled={pending}
        onChange={(e) => placeFromHold(e.target.value)}
        aria-label={`Placera ${task.title} på en dag`}
      >
        <option value="" disabled>
          Placera på dag…
        </option>
        {WEEKDAYS.map((d) => (
          <option key={d} value={String(d)}>
            {WEEKDAY_LONG[d]}
          </option>
        ))}
        <option value="resume">Tillbaka till att placera</option>
      </select>
    </li>
  );
}
