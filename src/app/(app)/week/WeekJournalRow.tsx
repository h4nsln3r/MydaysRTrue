"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { createPortal } from "react-dom";
import { formatDayShort, formatTime, formatWeekdayShort } from "@/lib/date";
import {
  JOURNAL_SOURCE_LABEL,
  type JournalDisplayEntry,
  type WeekJournalDay,
  type WeekJournalSummary,
} from "@/lib/journal";
import type { WeekDay } from "@/lib/water.server";
import gridStyles from "./week-progress.module.scss";
import styles from "./week-journal-modal.module.scss";

interface Props {
  days: WeekDay[];
  journalWeek: WeekJournalSummary;
}

export function WeekJournalRow({ days, journalWeek }: Props) {
  const [openDate, setOpenDate] = useState<string | null>(null);
  const journalByDate = new Map(
    journalWeek.days.map((d) => [d.localDate, d]),
  );
  const openDay = openDate ? journalByDate.get(openDate) : null;

  const close = useCallback(() => setOpenDate(null), []);

  useEffect(() => {
    if (!openDate) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [openDate, close]);

  const total = journalWeek.days.reduce((sum, d) => sum + d.entryCount, 0);

  return (
    <>
      <tr>
        <th
          className={[gridStyles.rowLabel, gridStyles.stickyCol].join(" ")}
          scope="row"
        >
          <span className={gridStyles.rowIcon} aria-hidden>
            📓
          </span>
          <span className={gridStyles.rowText}>Dagbok</span>
        </th>
        {days.map((d) => {
          const dayJournal = journalByDate.get(d.date);
          const entries = dayJournal?.entries ?? [];
          return (
            <td
              key={d.date}
              className={cellClass(
                gridStyles.dataCell,
                gridStyles.journalCell,
                d.isFuture && gridStyles.cellFuture,
                d.isToday && gridStyles.cellToday,
                entries.length > 0 && gridStyles.journalCellHasEntries,
              )}
            >
              {d.isFuture ? null : entries.length === 0 ? (
                <span className={gridStyles.emptyMark}>—</span>
              ) : (
                <button
                  type="button"
                  className={gridStyles.journalBtn}
                  onClick={() => setOpenDate(d.date)}
                  title={dayJournal?.narrative ?? dayJournal?.preview ?? ""}
                  aria-label={`Visa dagbok för ${formatDayShort(d.date)}`}
                >
                  <span className={gridStyles.journalCount}>
                    {entries.length}
                  </span>
                  {dayJournal?.narrative || dayJournal?.preview ? (
                    <span className={gridStyles.journalPreview}>
                      {dayJournal.narrative || dayJournal.preview}
                    </span>
                  ) : null}
                </button>
              )}
            </td>
          );
        })}
        <td
          className={cellClass(
            gridStyles.totalCell,
            total > 0 && gridStyles.totalCellDone,
          )}
        >
          {total > 0 ? (
            <span className={gridStyles.totalValue}>{total}</span>
          ) : (
            <span className={gridStyles.emptyMark}>—</span>
          )}
        </td>
      </tr>

      {openDay && openDate
        ? createPortal(
            <JournalDayModal
              date={openDate}
              day={openDay}
              isToday={days.find((d) => d.date === openDate)?.isToday ?? false}
              onClose={close}
            />,
            document.body,
          )
        : null}
    </>
  );
}

function JournalDayModal({
  date,
  day,
  isToday,
  onClose,
}: {
  date: string;
  day: WeekJournalDay;
  isToday: boolean;
  onClose: () => void;
}) {
  const dayHref = isToday ? "/" : `/day/${date}`;
  const title = `${formatWeekdayShort(date)} ${formatDayShort(date)}`;

  return (
    <div className={styles.backdrop} onClick={onClose}>
      <div
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="week-journal-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className={styles.header}>
          <div className={styles.headerText}>
            <p className={styles.kicker}>Dagbok</p>
            <h2 id="week-journal-modal-title" className={styles.title}>
              {title}
            </h2>
            <p className={styles.meta}>
              {day.entryCount}{" "}
              {day.entryCount === 1 ? "händelse" : "händelser"}
            </p>
          </div>
          <button
            type="button"
            className={styles.closeBtn}
            onClick={onClose}
            aria-label="Stäng"
          >
            ×
          </button>
        </header>

        <div className={styles.body}>
          {day.narrative ? (
            <section className={styles.narrativeSection}>
              <h3 className={styles.sectionLabel}>Sammanfattning</h3>
              <p className={styles.narrative}>{day.narrative}</p>
            </section>
          ) : null}

          {day.entries.length > 0 ? (
            <section className={styles.entriesSection}>
              <h3 className={styles.sectionLabel}>Alla händelser</h3>
              <ol className={styles.timeline}>
                {day.entries.map((entry) => (
                  <JournalEntryItem key={entry.id} entry={entry} />
                ))}
              </ol>
            </section>
          ) : (
            <p className={styles.empty}>Inga händelser den här dagen.</p>
          )}
        </div>

        <footer className={styles.footer}>
          <Link href={dayHref} className={styles.dayLink} onClick={onClose}>
            Öppna hela dagen →
          </Link>
        </footer>
      </div>
    </div>
  );
}

function JournalEntryItem({ entry }: { entry: JournalDisplayEntry }) {
  return (
    <li
      className={cellClass(
        styles.entry,
        entry.editable ? styles.entryManual : styles.entryAuto,
      )}
    >
      <div className={styles.entryMeta}>
        <span className={styles.entryIcon} aria-hidden>
          {entry.icon}
        </span>
        <span className={styles.entryTitle}>{entry.title}</span>
        <span className={styles.entrySource}>
          {JOURNAL_SOURCE_LABEL[entry.source]}
        </span>
        <time className={styles.entryTime} dateTime={entry.at}>
          {formatTime(entry.at)}
        </time>
      </div>
      {entry.body.trim() ? (
        <p className={styles.entryBody}>{entry.body}</p>
      ) : null}
    </li>
  );
}

function cellClass(...parts: (string | false | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}
