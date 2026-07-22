"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  archiveLeavePeriodAction,
  createLeavePeriodAction,
  updateLeavePeriodAction,
} from "@/app/(app)/leave-actions";
import { Button } from "@/components/Button/Button";
import { Input } from "@/components/Input/Input";
import { todayLocalISO } from "@/lib/date";
import {
  LEAVE_KIND_ICON,
  LEAVE_KIND_LABEL,
  countLeaveWeekdaysInYear,
  formatLeaveRange,
  leaveKindByDate,
  type LeaveKind,
  type LeavePeriod,
  type YearLeaveContext,
} from "@/lib/leave";
import styles from "./LeaveYearCalendar.module.scss";

const KINDS: LeaveKind[] = ["vacation", "day_off"];
const WEEKDAY_LABELS = ["M", "T", "O", "T", "F", "L", "S"];
const MONTH_LABELS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "Maj",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Okt",
  "Nov",
  "Dec",
];

interface Props {
  yearLeave: YearLeaveContext;
  /** When true, calendar is read-only (progress tab). */
  readOnly?: boolean;
}

function daysInMonth(year: number, monthIndex: number): number {
  return new Date(year, monthIndex + 1, 0).getDate();
}

/** ISO weekday 1=Mon … 7=Sun for the 1st of the month → 0-based Mon-first column. */
function firstColumnOffset(year: number, monthIndex: number): number {
  const jsDow = new Date(year, monthIndex, 1).getDay();
  return (jsDow + 6) % 7;
}

function inSelectedRange(
  date: string,
  rangeStart: string | null,
  rangeEnd: string | null,
): boolean {
  if (!rangeStart) return false;
  if (!rangeEnd) return date === rangeStart;
  const a = rangeStart <= rangeEnd ? rangeStart : rangeEnd;
  const b = rangeStart <= rangeEnd ? rangeEnd : rangeStart;
  return date >= a && date <= b;
}

export function LeaveYearCalendar({ yearLeave, readOnly = false }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [kind, setKind] = useState<LeaveKind>("vacation");
  const [note, setNote] = useState("");
  const [rangeStart, setRangeStart] = useState<string | null>(null);
  const [rangeEnd, setRangeEnd] = useState<string | null>(null);

  const leaveMap = useMemo(
    () => leaveKindByDate(yearLeave.periods),
    [yearLeave.periods],
  );
  const weekdayCount = useMemo(
    () => countLeaveWeekdaysInYear(yearLeave.periods, yearLeave.year),
    [yearLeave.periods, yearLeave.year],
  );
  const today = todayLocalISO();

  const clearSelection = () => {
    setRangeStart(null);
    setRangeEnd(null);
    setNote("");
    setError(null);
  };

  const onDayClick = (date: string) => {
    if (readOnly) return;
    setError(null);
    if (!rangeStart || (rangeStart && rangeEnd)) {
      setRangeStart(date);
      setRangeEnd(null);
      return;
    }
    setRangeEnd(date);
  };

  const add = () => {
    if (!rangeStart) {
      setError("Välj start- och slutdatum i kalendern.");
      return;
    }
    const startDate = rangeStart;
    const endDate = rangeEnd ?? rangeStart;

    setError(null);
    startTransition(async () => {
      const res = await createLeavePeriodAction({
        kind,
        startDate,
        endDate,
        note,
      });
      if (!res.ok) {
        setError(res.error ?? "Kunde inte spara.");
        return;
      }
      clearSelection();
      router.refresh();
    });
  };

  return (
    <div className={styles.board}>
      <p className={styles.hint}>
        {readOnly
          ? `Semester och lediga dagar ${yearLeave.year}. Jobb start/slut visas inte på dessa dagar.`
          : `Markera en dag eller ett intervall i kalendern. Då hoppas Jobb start och Jobb slut över automatiskt.`}
      </p>

      {weekdayCount > 0 ? (
        <p className={styles.summary}>
          {weekdayCount} lediga vardagar · {yearLeave.periods.length}{" "}
          {yearLeave.periods.length === 1 ? "period" : "perioder"}
        </p>
      ) : null}

      <div className={styles.legend} aria-hidden>
        <span className={styles.legendItem}>
          <span className={[styles.swatch, styles.swatchVacation].join(" ")} />
          Semester
        </span>
        <span className={styles.legendItem}>
          <span className={[styles.swatch, styles.swatchDayOff].join(" ")} />
          Ledig
        </span>
        <span className={styles.legendItem}>
          <span className={[styles.swatch, styles.swatchSelected].join(" ")} />
          Val
        </span>
      </div>

      <div className={styles.yearGrid}>
        {MONTH_LABELS.map((label, monthIndex) => (
          <MonthGrid
            key={label}
            year={yearLeave.year}
            monthIndex={monthIndex}
            label={label}
            leaveMap={leaveMap}
            rangeStart={rangeStart}
            rangeEnd={rangeEnd}
            today={today}
            readOnly={readOnly}
            onDayClick={onDayClick}
          />
        ))}
      </div>

      {!readOnly && rangeStart ? (
        <div className={styles.form}>
          <p className={styles.hint}>
            {rangeEnd
              ? `Valt: ${formatLeaveRange({
                  startDate: rangeStart <= rangeEnd ? rangeStart : rangeEnd,
                  endDate: rangeStart <= rangeEnd ? rangeEnd : rangeStart,
                })}`
              : `Start: ${rangeStart} — klicka slutdatum (eller spara för en dag)`}
          </p>
          <div className={styles.kindRow} role="radiogroup" aria-label="Typ">
            {KINDS.map((k) => (
              <button
                key={k}
                type="button"
                role="radio"
                aria-checked={kind === k}
                aria-pressed={kind === k}
                className={styles.kindBtn}
                onClick={() => setKind(k)}
                disabled={pending}
              >
                {LEAVE_KIND_ICON[k]} {LEAVE_KIND_LABEL[k]}
              </button>
            ))}
          </div>
          <Input
            label="Anteckning (valfritt)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="t.ex. sommaren, klämdag"
            maxLength={280}
            disabled={pending}
          />
          <div className={styles.formActions}>
            <Button
              type="button"
              variant="ghost"
              size="md"
              onClick={clearSelection}
              disabled={pending}
            >
              Avbryt
            </Button>
            <Button
              type="button"
              variant="primary"
              size="md"
              loading={pending}
              disabled={pending}
              onClick={add}
            >
              Spara ledighet
            </Button>
          </div>
        </div>
      ) : null}

      {yearLeave.periods.length > 0 ? (
        <ul className={styles.list}>
          {yearLeave.periods.map((period) => (
            <PeriodRow
              key={period.id}
              period={period}
              pending={pending}
              readOnly={readOnly}
              onError={setError}
            />
          ))}
        </ul>
      ) : (
        <p className={styles.empty}>Ingen ledighet inlagd ännu.</p>
      )}

      {error ? <p className={styles.error}>{error}</p> : null}
    </div>
  );
}

function MonthGrid({
  year,
  monthIndex,
  label,
  leaveMap,
  rangeStart,
  rangeEnd,
  today,
  readOnly,
  onDayClick,
}: {
  year: number;
  monthIndex: number;
  label: string;
  leaveMap: Map<string, LeaveKind>;
  rangeStart: string | null;
  rangeEnd: string | null;
  today: string;
  readOnly: boolean;
  onDayClick: (date: string) => void;
}) {
  const total = daysInMonth(year, monthIndex);
  const offset = firstColumnOffset(year, monthIndex);
  const cells: Array<{ date: string | null; day: number | null }> = [];

  for (let i = 0; i < offset; i++) {
    cells.push({ date: null, day: null });
  }
  for (let day = 1; day <= total; day++) {
    const date = `${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    cells.push({ date, day });
  }

  return (
    <div className={styles.month}>
      <h3 className={styles.monthTitle}>{label}</h3>
      <div className={styles.weekdayRow} aria-hidden>
        {WEEKDAY_LABELS.map((w, i) => (
          <span key={`${w}-${i}`} className={styles.weekdayLabel}>
            {w}
          </span>
        ))}
      </div>
      <div className={styles.days}>
        {cells.map((cell, i) => {
          if (!cell.date || cell.day == null) {
            return <span key={`e-${i}`} className={styles.dayEmpty} />;
          }
          const leaveKind = leaveMap.get(cell.date);
          const selected = inSelectedRange(cell.date, rangeStart, rangeEnd);
          const isToday = cell.date === today;
          const classNames = [
            styles.day,
            leaveKind === "vacation" ? styles.dayVacation : null,
            leaveKind === "day_off" ? styles.dayOff : null,
            selected ? styles.daySelected : null,
            isToday ? styles.dayToday : null,
          ]
            .filter(Boolean)
            .join(" ");

          if (readOnly) {
            return (
              <span
                key={cell.date}
                className={classNames}
                title={
                  leaveKind
                    ? LEAVE_KIND_LABEL[leaveKind]
                    : undefined
                }
              >
                {cell.day}
              </span>
            );
          }

          return (
            <button
              key={cell.date}
              type="button"
              className={classNames}
              onClick={() => onDayClick(cell.date!)}
              aria-label={`${cell.date}${leaveKind ? `, ${LEAVE_KIND_LABEL[leaveKind]}` : ""}`}
              aria-pressed={selected}
            >
              {cell.day}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function PeriodRow({
  period,
  pending,
  readOnly,
  onError,
}: {
  period: LeavePeriod;
  pending: boolean;
  readOnly: boolean;
  onError: (msg: string | null) => void;
}) {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [editKind, setEditKind] = useState(period.kind);
  const [editStart, setEditStart] = useState(period.startDate);
  const [editEnd, setEditEnd] = useState(period.endDate);
  const [editNote, setEditNote] = useState(period.note ?? "");
  const [localPending, startTransition] = useTransition();
  const [localError, setLocalError] = useState<string | null>(null);
  const busy = pending || localPending;

  const saveEdit = () => {
    setLocalError(null);
    onError(null);
    startTransition(async () => {
      const res = await updateLeavePeriodAction({
        id: period.id,
        kind: editKind,
        startDate: editStart,
        endDate: editEnd,
        note: editNote,
      });
      if (!res.ok) {
        setLocalError(res.error ?? "Kunde inte spara.");
        return;
      }
      setIsEditing(false);
      router.refresh();
    });
  };

  const remove = () => {
    onError(null);
    startTransition(async () => {
      const res = await archiveLeavePeriodAction(period.id);
      if (!res.ok) onError(res.error ?? "Kunde inte ta bort.");
      router.refresh();
    });
  };

  if (isEditing && !readOnly) {
    return (
      <li className={[styles.item, styles.itemEditing].join(" ")}>
        <div className={styles.editForm}>
          <div className={styles.kindRow}>
            {KINDS.map((k) => (
              <button
                key={k}
                type="button"
                className={styles.kindBtn}
                aria-pressed={editKind === k}
                onClick={() => setEditKind(k)}
                disabled={busy}
              >
                {LEAVE_KIND_ICON[k]} {LEAVE_KIND_LABEL[k]}
              </button>
            ))}
          </div>
          <Input
            label="Från"
            type="date"
            value={editStart}
            onChange={(e) => setEditStart(e.target.value)}
            disabled={busy}
          />
          <Input
            label="Till"
            type="date"
            value={editEnd}
            onChange={(e) => setEditEnd(e.target.value)}
            disabled={busy}
          />
          <Input
            label="Anteckning"
            value={editNote}
            onChange={(e) => setEditNote(e.target.value)}
            maxLength={280}
            disabled={busy}
          />
          {localError ? <p className={styles.error}>{localError}</p> : null}
          <div className={styles.formActions}>
            <Button
              type="button"
              variant="ghost"
              size="md"
              onClick={() => setIsEditing(false)}
              disabled={busy}
            >
              Avbryt
            </Button>
            <Button
              type="button"
              variant="primary"
              size="md"
              loading={busy}
              onClick={saveEdit}
            >
              Spara
            </Button>
          </div>
        </div>
      </li>
    );
  }

  return (
    <li className={styles.item}>
      <span className={styles.itemIcon} aria-hidden>
        {LEAVE_KIND_ICON[period.kind]}
      </span>
      <div className={styles.itemMeta}>
        <span className={styles.itemTitle}>{LEAVE_KIND_LABEL[period.kind]}</span>
        <span className={styles.itemSub}>{formatLeaveRange(period)}</span>
        {period.note ? (
          <span className={styles.itemNote}>{period.note}</span>
        ) : null}
      </div>
      {!readOnly ? (
        <>
          <button
            type="button"
            className={styles.editBtn}
            onClick={() => setIsEditing(true)}
            disabled={busy}
          >
            Redigera
          </button>
          <button
            type="button"
            className={styles.removeBtn}
            onClick={remove}
            disabled={busy}
          >
            Ta bort
          </button>
        </>
      ) : null}
    </li>
  );
}
