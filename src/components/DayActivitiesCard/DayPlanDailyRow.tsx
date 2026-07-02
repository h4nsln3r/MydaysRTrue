"use client";

import { useEffect, useState, useTransition } from "react";
import {
  clearMealAction,
  clearSnackAction,
  saveDailyActivityAction,
  saveMealAction,
  saveSnackAction,
  setHabitStatusAction,
} from "@/app/(app)/actions";
import {
  clearIntakeAction,
  saveIntakeAction,
} from "@/app/(app)/intake-actions";
import {
  logWorkEndAction,
  logWorkStartAction,
  updateWorkNotesAction,
} from "@/app/(app)/work-actions";
import { Button } from "@/components/Button/Button";
import { Input } from "@/components/Input/Input";
import {
  mealCookedByDisplay,
  mealHasCookingMeta,
  type MealKey,
  type MealRestaurant,
  type MealBoxStockItem,
  type SnackSlot,
} from "@/lib/habits";
import {
  MealCookingMetaFields,
  initialMealCookingMeta,
  validateMealCookingMeta,
} from "@/components/MealCookingMeta/MealCookingMetaFields";
import { formatInteger } from "@/lib/format";
import type { DayPlanItem } from "@/lib/day-plan";
import {
  dayPlanItemAccent,
  dayPlanItemIcon,
  dayPlanItemLabel,
} from "@/lib/day-plan";
import { PlanCadenceBadge, type PlanCadence } from "@/components/PlanCadenceBadge/PlanCadenceBadge";
import {
  INTAKE_DESCRIPTION_LABEL,
  INTAKE_DESCRIPTION_PLACEHOLDER,
  INTAKE_HAS_WATER,
  INTAKE_REQUIRES_DESCRIPTION,
  type IntakeKind,
} from "@/lib/intake";
import { formatTime } from "@/lib/date";
import { formatMl } from "@/lib/water";
import styles from "@/components/WeeklyTasksDayCard/WeeklyTasksDayCard.module.scss";
import type { PlanSortableProps } from "./usePlanSortable";

function sortableShellProps(props: PlanSortableProps) {
  return {
    dragHandle: props.dragHandle,
    sortableRef: props.sortableRef,
    sortableStyle: props.sortableStyle,
  };
}

interface DailyRowProps extends PlanSortableProps {
  item: DayPlanItem;
  date: string;
  savedRestaurants?: MealRestaurant[];
  mealBoxStock?: MealBoxStockItem[];
  expanded: boolean;
  busy: boolean;
  pending: boolean;
  onToggleExpand: () => void;
  onError: (msg: string | null) => void;
  onPendingKey: (active: boolean) => void;
  onDone: () => void;
  planningMode?: boolean;
}

export function DayPlanDailyRow(props: DailyRowProps) {
  switch (props.item.kind) {
    case "meal":
      return <MealPlanRow {...props} item={props.item} />;
    case "snack":
      return <SnackPlanRow {...props} item={props.item} />;
    case "intake":
      return <IntakePlanRow {...props} item={props.item} />;
    case "habit":
      return <HabitPlanRow {...props} item={props.item} />;
    case "work_start":
    case "work_end":
      return <WorkPlanRow {...props} item={props.item} />;
    case "steps":
      return <StepsPlanRow {...props} item={props.item} />;
    case "activity_hours":
      return <ActivityPlanRow {...props} item={props.item} />;
    default:
      return null;
  }
}

interface ShellProps extends PlanSortableProps {
  item: DayPlanItem;
  done: boolean;
  detail: string | null;
  cadence?: PlanCadence;
  expanded: boolean;
  busy: boolean;
  pending: boolean;
  onToggleExpand: () => void;
  planningMode?: boolean;
  children?: React.ReactNode;
}

function PlanRowShell({
  item,
  done,
  detail,
  cadence,
  expanded,
  busy,
  pending,
  onToggleExpand,
  planningMode = false,
  dragHandle,
  sortableRef,
  sortableStyle,
  children,
}: ShellProps) {
  const accent = dayPlanItemAccent(item);
  const icon = dayPlanItemIcon(item);
  const label = dayPlanItemLabel(item);

  return (
    <li
      ref={sortableRef}
      style={sortableStyle}
      className={[
        styles.task,
        styles.taskDraggable,
        done ? styles.taskDone : "",
        busy ? styles.taskBusy : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {cadence ? <PlanCadenceBadge cadence={cadence} done={done} corner /> : null}
      {dragHandle}
      <button
        type="button"
        className={[styles.checkBtn, done ? styles.checkBtnDone : ""]
          .filter(Boolean)
          .join(" ")}
        aria-label={planningMode ? undefined : done ? "Klart" : "Logga"}
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

      <button
        type="button"
        className={styles.taskBody}
        onClick={planningMode ? undefined : onToggleExpand}
        aria-expanded={planningMode ? undefined : expanded}
        disabled={pending || planningMode}
      >
        <span className={styles.taskIcon} aria-hidden style={{ borderColor: accent }}>
          {icon}
        </span>
        <span className={styles.taskMeta}>
          <span className={styles.taskTitle}>{label}</span>
          {detail ? <span className={styles.taskDetail}>{detail}</span> : null}
        </span>
        {planningMode ? null : (
          <span
            className={[styles.chevron, expanded ? styles.chevronUp : ""]
              .filter(Boolean)
              .join(" ")}
            aria-hidden
          >
            ▾
          </span>
        )}
      </button>

      {!planningMode && expanded ? (
        <div className={styles.taskActions}>{children}</div>
      ) : null}
    </li>
  );
}

function MealPlanRow(
  props: DailyRowProps & { item: Extract<DayPlanItem, { kind: "meal" }> },
) {
  const {
    item,
    date,
    savedRestaurants = [],
    mealBoxStock = [],
    expanded,
    busy,
    pending,
    onToggleExpand,
    onError,
    onPendingKey,
    onDone,
  } = props;
  const entry = item.entry;
  const done = Boolean(entry);
  const [description, setDescription] = useState(entry?.description ?? "");
  const [waterMl, setWaterMl] = useState(
    entry?.waterMl ? String(entry.waterMl) : "",
  );
  const [cookingMeta, setCookingMeta] = useState(() =>
    initialMealCookingMeta(entry),
  );
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  useEffect(() => {
    setDescription(entry?.description ?? "");
    setWaterMl(entry?.waterMl ? String(entry.waterMl) : "");
    setCookingMeta(initialMealCookingMeta(entry));
  }, [entry]);

  const showCookingMeta = mealHasCookingMeta(item.meal);
  const eatingMealBox = showCookingMeta && cookingMeta.cookedBy === "meal_box";

  const detail = entry
    ? [
        entry.description,
        mealCookedByDisplay(
          entry.cookedBy,
          entry.restaurantName,
          entry.cookedByName,
        ),
        entry.waterMl > 0 ? formatMl(entry.waterMl) : null,
      ]
        .filter(Boolean)
        .join(" · ")
    : null;

  const save = () => {
    onError(null);
    const parsedWater = waterMl.trim() === "" ? 0 : Number(waterMl);
    if (!Number.isFinite(parsedWater) || parsedWater < 0) {
      setError("Vattnet måste vara ett positivt tal.");
      return;
    }
    const cookingResult = showCookingMeta
      ? validateMealCookingMeta(cookingMeta)
      : {
          ok: true as const,
          mealBoxes: null,
          mealBoxStockId: null,
          descriptionFromStock: null,
        };
    if (!cookingResult.ok) {
      setError(cookingResult.error);
      return;
    }
    if (!eatingMealBox && !description.trim()) {
      setError("Skriv vad du åt.");
      return;
    }

    const stockItem =
      eatingMealBox && cookingResult.mealBoxStockId
        ? mealBoxStock.find((s) => s.id === cookingResult.mealBoxStockId)
        : null;

    onPendingKey(true);
    startTransition(async () => {
      const res = await saveMealAction({
        meal: item.meal,
        localDate: date,
        description: stockItem?.description ?? description,
        waterMl: Math.round(parsedWater),
        cookedBy: showCookingMeta ? cookingMeta.cookedBy : null,
        mealBoxes: cookingResult.mealBoxes,
        mealBoxStockId: cookingResult.mealBoxStockId,
        restaurantId:
          showCookingMeta && cookingMeta.cookedBy === "restaurant"
            ? cookingMeta.restaurantId
            : null,
        restaurantName:
          showCookingMeta && cookingMeta.cookedBy === "restaurant"
            ? cookingMeta.restaurantName
            : null,
        cookedByName:
          showCookingMeta && cookingMeta.cookedBy === "other"
            ? cookingMeta.cookedByName
            : null,
      });
      if (!res.ok) {
        onError(res.error ?? "Kunde inte spara.");
        setError(res.error ?? "Kunde inte spara.");
      }
      onPendingKey(false);
      onDone();
    });
  };

  const clear = () => {
    onError(null);
    onPendingKey(true);
    startTransition(async () => {
      const res = await clearMealAction({ meal: item.meal, localDate: date });
      if (!res.ok) onError(res.error ?? "Kunde inte ta bort.");
      onPendingKey(false);
      onDone();
    });
  };

  return (
    <PlanRowShell
      item={item}
      done={done}
      detail={detail}
      expanded={expanded}
      busy={busy}
      pending={pending}
      onToggleExpand={onToggleExpand}
      {...sortableShellProps(props)}
      planningMode={props.planningMode}
    >
      {error ? <p className={styles.error}>{error}</p> : null}
      {!done ? (
        <>
          <Input
            label="Vad åt du?"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="t.ex. yoghurt, banan, två skivor bröd"
            maxLength={280}
            autoFocus={!eatingMealBox}
            disabled={pending || eatingMealBox}
            hint={
              eatingMealBox
                ? "Fylls i automatiskt när du väljer matlåda nedan."
                : undefined
            }
          />
          {showCookingMeta ? (
            <MealCookingMetaFields
              layout="plan"
              meta={cookingMeta}
              savedRestaurants={savedRestaurants}
              mealBoxStock={mealBoxStock}
              pending={pending}
              onChange={setCookingMeta}
              onPickMealBox={setDescription}
            />
          ) : null}
          <Input
            label="Vatten till måltiden (valfritt)"
            type="number"
            min={0}
            max={5000}
            step={50}
            value={waterMl}
            onChange={(e) => setWaterMl(e.target.value)}
            placeholder="0"
            suffix="ml"
            disabled={pending}
          />
          <Button
            type="button"
            variant="primary"
            size="md"
            fullWidth
            loading={pending && busy}
            disabled={pending || !description.trim()}
            onClick={save}
          >
            Markera äten
          </Button>
        </>
      ) : (
        <>
          <button type="button" className={styles.undoBtn} onClick={clear} disabled={pending}>
            Ångra
          </button>
        </>
      )}
    </PlanRowShell>
  );
}

function SnackPlanRow(
  props: DailyRowProps & { item: Extract<DayPlanItem, { kind: "snack" }> },
) {
  const {
    item,
    date,
    expanded,
    busy,
    pending,
    onToggleExpand,
    onError,
    onPendingKey,
    onDone,
  } = props;
  const entry = item.entry;
  const done = Boolean(entry);
  const [description, setDescription] = useState(entry?.description ?? "");
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  useEffect(() => {
    setDescription(entry?.description ?? "");
  }, [entry]);

  const save = () => {
    onError(null);
    onPendingKey(true);
    startTransition(async () => {
      const res = await saveSnackAction({
        slot: item.slot,
        localDate: date,
        description,
      });
      if (!res.ok) {
        onError(res.error ?? "Kunde inte spara.");
        setError(res.error ?? "Kunde inte spara.");
      }
      onPendingKey(false);
      onDone();
    });
  };

  const clear = () => {
    onError(null);
    onPendingKey(true);
    startTransition(async () => {
      const res = await clearSnackAction({ localDate: date, slot: item.slot });
      if (!res.ok) onError(res.error ?? "Kunde inte ta bort.");
      onPendingKey(false);
      onDone();
    });
  };

  return (
    <PlanRowShell
      item={item}
      done={done}
      detail={entry?.description ?? null}
      expanded={expanded}
      busy={busy}
      pending={pending}
      onToggleExpand={onToggleExpand}
      {...sortableShellProps(props)}
      planningMode={props.planningMode}
    >
      {error ? <p className={styles.error}>{error}</p> : null}
      {!done ? (
        <>
          <Input
            label="Vad innehöll mellanmålet?"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="t.ex. äpple och nötter"
            maxLength={280}
            autoFocus
            disabled={pending}
          />
          <Button
            type="button"
            variant="primary"
            size="md"
            fullWidth
            loading={pending && busy}
            disabled={pending || !description.trim()}
            onClick={save}
          >
            Markera äten
          </Button>
        </>
      ) : (
        <button type="button" className={styles.undoBtn} onClick={clear} disabled={pending}>
          Ångra
        </button>
      )}
    </PlanRowShell>
  );
}

function IntakePlanRow(
  props: DailyRowProps & { item: Extract<DayPlanItem, { kind: "intake" }> },
) {
  const {
    item,
    date,
    expanded,
    busy,
    pending,
    onToggleExpand,
    onError,
    onPendingKey,
    onDone,
  } = props;
  const entry = item.entry;
  const kind = item.intakeKind;
  const done = Boolean(entry);
  const hasWater = INTAKE_HAS_WATER[kind];
  const requiresDescription = INTAKE_REQUIRES_DESCRIPTION[kind];
  const [description, setDescription] = useState(entry?.description ?? "");
  const [waterMl, setWaterMl] = useState(
    entry?.waterMl ? String(entry.waterMl) : "",
  );
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  useEffect(() => {
    setDescription(entry?.description ?? "");
    setWaterMl(entry?.waterMl ? String(entry.waterMl) : "");
  }, [entry]);

  const detail = entry
    ? [entry.description, entry.waterMl > 0 ? formatMl(entry.waterMl) : null]
        .filter(Boolean)
        .join(" · ") || "Klart"
    : null;

  const save = () => {
    onError(null);
    let parsedWater = 0;
    if (hasWater) {
      parsedWater = waterMl.trim() === "" ? 0 : Number(waterMl);
      if (!Number.isFinite(parsedWater) || parsedWater < 0) {
        setError("Vattnet måste vara ett positivt tal.");
        return;
      }
    }
    onPendingKey(true);
    startTransition(async () => {
      const res = await saveIntakeAction({
        kind,
        localDate: date,
        description,
        waterMl: hasWater ? Math.round(parsedWater) : 0,
      });
      if (!res.ok) {
        onError(res.error ?? "Kunde inte spara.");
        setError(res.error ?? "Kunde inte spara.");
      }
      onPendingKey(false);
      onDone();
    });
  };

  const clear = () => {
    onError(null);
    onPendingKey(true);
    startTransition(async () => {
      const res = await clearIntakeAction({ kind, localDate: date });
      if (!res.ok) onError(res.error ?? "Kunde inte ta bort.");
      onPendingKey(false);
      onDone();
    });
  };

  return (
    <PlanRowShell
      item={item}
      done={done}
      detail={detail}
      expanded={expanded}
      busy={busy}
      pending={pending}
      onToggleExpand={onToggleExpand}
      {...sortableShellProps(props)}
      planningMode={props.planningMode}
    >
      {error ? <p className={styles.error}>{error}</p> : null}
      {!done ? (
        <>
          <Input
            label={INTAKE_DESCRIPTION_LABEL[kind]}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={INTAKE_DESCRIPTION_PLACEHOLDER[kind]}
            maxLength={280}
            autoFocus
            required={requiresDescription}
            disabled={pending}
          />
          {hasWater ? (
            <Input
              label="Vatten (valfritt)"
              type="number"
              min={0}
              max={5000}
              step={50}
              value={waterMl}
              onChange={(e) => setWaterMl(e.target.value)}
              placeholder="0"
              suffix="ml"
              disabled={pending}
            />
          ) : null}
          <Button
            type="button"
            variant="primary"
            size="md"
            fullWidth
            loading={pending && busy}
            disabled={
              pending || (requiresDescription && !description.trim())
            }
            onClick={save}
          >
            Markera klart
          </Button>
        </>
      ) : (
        <button type="button" className={styles.undoBtn} onClick={clear} disabled={pending}>
          Ångra
        </button>
      )}
    </PlanRowShell>
  );
}

function HabitPlanRow(
  props: DailyRowProps & { item: Extract<DayPlanItem, { kind: "habit" }> },
) {
  const {
    item,
    date,
    expanded,
    busy,
    pending,
    onToggleExpand,
    onError,
    onPendingKey,
    onDone,
  } = props;
  const done = item.status === "yes";
  const [note, setNote] = useState(item.note ?? "");
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  useEffect(() => {
    setNote(item.note ?? "");
  }, [item.note]);

  const detail = item.note?.trim() || null;

  const save = () => {
    onError(null);
    onPendingKey(true);
    startTransition(async () => {
      const res = await setHabitStatusAction({
        habitId: item.id,
        localDate: date,
        status: "yes",
        note: note.trim() || null,
      });
      if (!res.ok) {
        onError(res.error ?? "Kunde inte spara.");
        setError(res.error ?? "Kunde inte spara.");
      }
      onPendingKey(false);
      onDone();
    });
  };

  const clear = () => {
    onError(null);
    onPendingKey(true);
    startTransition(async () => {
      const res = await setHabitStatusAction({
        habitId: item.id,
        localDate: date,
        status: null,
      });
      if (!res.ok) onError(res.error ?? "Kunde inte ta bort.");
      onPendingKey(false);
      onDone();
    });
  };

  return (
    <PlanRowShell
      item={item}
      done={done}
      detail={detail}
      cadence="daily"
      expanded={expanded}
      busy={busy}
      pending={pending}
      onToggleExpand={onToggleExpand}
      {...sortableShellProps(props)}
      planningMode={props.planningMode}
    >
      {error ? <p className={styles.error}>{error}</p> : null}
      {!done ? (
        <>
          <Input
            label="Kommentar (valfritt)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="t.ex. plockade undan i vardagsrummet"
            maxLength={280}
            autoFocus
            disabled={pending}
          />
          <Button
            type="button"
            variant="primary"
            size="md"
            fullWidth
            loading={pending && busy}
            disabled={pending}
            onClick={save}
          >
            Markera klart
          </Button>
        </>
      ) : (
        <button type="button" className={styles.undoBtn} onClick={clear} disabled={pending}>
          Ångra
        </button>
      )}
    </PlanRowShell>
  );
}

function WorkPlanRow(
  props: DailyRowProps & {
    item: Extract<DayPlanItem, { kind: "work_start" | "work_end" }>;
  },
) {
  const {
    item,
    date,
    expanded,
    busy,
    pending,
    onToggleExpand,
    onError,
    onPendingKey,
    onDone,
  } = props;
  const isStart = item.kind === "work_start";
  const work = item.work;
  const done = isStart ? Boolean(work.startedAt) : Boolean(work.endedAt);
  const timestamp = isStart ? work.startedAt : work.endedAt;
  const [note, setNote] = useState(
    isStart ? (work.startNote ?? "") : (work.endNote ?? ""),
  );
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  useEffect(() => {
    setNote(isStart ? (work.startNote ?? "") : (work.endNote ?? ""));
  }, [isStart, work.startNote, work.endNote]);

  const log = () => {
    onError(null);
    onPendingKey(true);
    startTransition(async () => {
      const res = isStart
        ? await logWorkStartAction({ localDate: date, note })
        : await logWorkEndAction({ localDate: date, note });
      if (!res.ok) {
        onError(res.error ?? "Kunde inte spara.");
        setError(res.error ?? "Kunde inte spara.");
      }
      onPendingKey(false);
      onDone();
    });
  };

  const detail = timestamp ? formatTime(timestamp) : null;
  const canLog = isStart ? !done : Boolean(work.startedAt) && !done;

  return (
    <PlanRowShell
      item={item}
      done={done}
      detail={detail}
      expanded={expanded}
      busy={busy}
      pending={pending}
      onToggleExpand={onToggleExpand}
      {...sortableShellProps(props)}
      planningMode={props.planningMode}
    >
      {error ? <p className={styles.error}>{error}</p> : null}
      <Input
        label="Kommentar"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder={isStart ? "t.ex. på kontoret" : "t.ex. det var lugnt idag"}
        maxLength={500}
        disabled={pending || (isStart ? done : !work.startedAt || done)}
      />
      {canLog ? (
        <Button
          type="button"
          variant="primary"
          size="md"
          fullWidth
          loading={pending && busy}
          disabled={pending}
          onClick={log}
        >
          {isStart ? "Logga start" : "Logga slut"}
        </Button>
      ) : null}
      {done &&
      note !==
        (isStart ? (work.startNote ?? "") : (work.endNote ?? "")) ? (
        <Button
          type="button"
          variant="outline"
          size="md"
          fullWidth
          loading={pending && busy}
          disabled={pending}
          onClick={() => {
            onError(null);
            onPendingKey(true);
            startTransition(async () => {
              const res = await updateWorkNotesAction({
                localDate: date,
                startNote: isStart ? note : work.startNote ?? "",
                endNote: isStart ? work.endNote ?? "" : note,
              });
              if (!res.ok) onError(res.error ?? "Kunde inte spara.");
              onPendingKey(false);
              onDone();
            });
          }}
        >
          Spara kommentar
        </Button>
      ) : null}
    </PlanRowShell>
  );
}

function StepsPlanRow(
  props: DailyRowProps & { item: Extract<DayPlanItem, { kind: "steps" }> },
) {
  const { item, date, expanded, busy, pending, onToggleExpand, onError, onPendingKey, onDone } =
    props;
  const done = item.steps != null;
  const [stepsVal, setStepsVal] = useState(
    item.steps != null ? String(item.steps) : "",
  );
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  useEffect(() => {
    setStepsVal(item.steps != null ? String(item.steps) : "");
  }, [item.steps]);

  const detail =
    item.steps != null
      ? `${formatInteger(item.steps)} / ${formatInteger(item.stepsGoal)}`
      : null;

  const save = () => {
    const trimmed = stepsVal.trim();
    const next = trimmed === "" ? null : Math.round(Number(trimmed));
    if (next != null && (!Number.isFinite(next) || next < 0)) {
      setError("Ogiltigt antal steg.");
      return;
    }
    onError(null);
    onPendingKey(true);
    startTransition(async () => {
      const res = await saveDailyActivityAction({
        localDate: date,
        steps: next,
      });
      if (!res.ok) {
        onError(res.error ?? "Kunde inte spara.");
        setError(res.error ?? "Kunde inte spara.");
      }
      onPendingKey(false);
      onDone();
    });
  };

  return (
    <PlanRowShell
      item={item}
      done={done}
      detail={detail}
      expanded={expanded}
      busy={busy}
      pending={pending}
      onToggleExpand={onToggleExpand}
      {...sortableShellProps(props)}
      planningMode={props.planningMode}
    >
      {error ? <p className={styles.error}>{error}</p> : null}
      <Input
        label="Antal steg idag"
        type="number"
        min={0}
        max={200000}
        step={100}
        value={stepsVal}
        onChange={(e) => setStepsVal(e.target.value)}
        placeholder={`T.ex. ${formatInteger(item.stepsGoal)}`}
        inputMode="numeric"
        disabled={pending}
      />
      <Button
        type="button"
        variant="primary"
        size="md"
        fullWidth
        loading={pending && busy}
        disabled={pending}
        onClick={save}
      >
        Spara steg
      </Button>
    </PlanRowShell>
  );
}

function ActivityPlanRow(
  props: DailyRowProps & {
    item: Extract<DayPlanItem, { kind: "activity_hours" }>;
  },
) {
  const { item, date, expanded, busy, pending, onToggleExpand, onError, onPendingKey, onDone } =
    props;
  const done = item.activityHours != null;
  const [hoursVal, setHoursVal] = useState(
    item.activityHours != null ? String(item.activityHours) : "",
  );
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  useEffect(() => {
    setHoursVal(
      item.activityHours != null ? String(item.activityHours) : "",
    );
  }, [item.activityHours]);

  const detail =
    item.activityHours != null
      ? `${item.activityHours} / ${item.activityHoursGoal} tim`
      : null;

  const save = () => {
    const trimmed = hoursVal.trim();
    const next = trimmed === "" ? null : Math.round(Number(trimmed) * 10) / 10;
    if (next != null && (!Number.isFinite(next) || next < 0)) {
      setError("Ogiltigt antal timmar.");
      return;
    }
    onError(null);
    onPendingKey(true);
    startTransition(async () => {
      const res = await saveDailyActivityAction({
        localDate: date,
        activityHours: next,
      });
      if (!res.ok) {
        onError(res.error ?? "Kunde inte spara.");
        setError(res.error ?? "Kunde inte spara.");
      }
      onPendingKey(false);
      onDone();
    });
  };

  return (
    <PlanRowShell
      item={item}
      done={done}
      detail={detail}
      expanded={expanded}
      busy={busy}
      pending={pending}
      onToggleExpand={onToggleExpand}
      {...sortableShellProps(props)}
      planningMode={props.planningMode}
    >
      {error ? <p className={styles.error}>{error}</p> : null}
      <Input
        label="Aktiva timmar idag"
        type="number"
        min={0}
        max={24}
        step={0.5}
        value={hoursVal}
        onChange={(e) => setHoursVal(e.target.value)}
        placeholder={`T.ex. ${item.activityHoursGoal}`}
        inputMode="decimal"
        disabled={pending}
      />
      <Button
        type="button"
        variant="primary"
        size="md"
        fullWidth
        loading={pending && busy}
        disabled={pending}
        onClick={save}
      >
        Spara aktivitet
      </Button>
    </PlanRowShell>
  );
}
