"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  addJournalEntryAction,
  deleteJournalEntryAction,
  reorderJournalEntriesAction,
  updateJournalEntryAction,
} from "@/app/(app)/journal-actions";
import { Button } from "@/components/Button/Button";
import { Card } from "@/components/Card/Card";
import { useSyncNavPending } from "@/components/NavProgress/NavProgress";
import { formatTime } from "@/lib/date";
import {
  JOURNAL_SOURCE_LABEL,
  buildJournalNarrative,
  type DailyJournal,
  type JournalDisplayEntry,
} from "@/lib/journal";
import styles from "./JournalDaySection.module.scss";

interface Props {
  date: string;
  journal: DailyJournal;
}

export function JournalDaySection({ date, journal }: Props) {
  const router = useRouter();
  const [draft, setDraft] = useState("");
  const [showDetails, setShowDetails] = useState(false);
  const [entries, setEntries] = useState(journal.entries);
  const [narrative, setNarrative] = useState(journal.narrative);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [reorderBusy, setReorderBusy] = useState(false);

  useSyncNavPending(pending || reorderBusy, journal);

  useEffect(() => {
    setEntries(journal.entries);
    setNarrative(journal.narrative);
  }, [journal]);

  const addEntry = () => {
    setError(null);
    startTransition(async () => {
      const res = await addJournalEntryAction({ localDate: date, body: draft });
      if (!res.ok) {
        setError(res.error ?? "Kunde inte spara.");
        return;
      }
      setDraft("");
      router.refresh();
    });
  };

  const moveEntry = (index: number, direction: -1 | 1) => {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= entries.length || reorderBusy) return;

    const previousEntries = entries;
    const previousNarrative = narrative;
    const next = [...entries];
    const tmp = next[index];
    next[index] = next[nextIndex];
    next[nextIndex] = tmp;

    setEntries(next);
    setNarrative(buildJournalNarrative(next));
    setError(null);
    setReorderBusy(true);

    startTransition(async () => {
      const res = await reorderJournalEntriesAction({
        localDate: date,
        orderedIds: next.map((entry) => entry.id),
      });
      if (!res.ok) {
        setError(res.error ?? "Kunde inte ändra ordning.");
        setEntries(previousEntries);
        setNarrative(previousNarrative);
        setReorderBusy(false);
        return;
      }
      router.refresh();
      setReorderBusy(false);
    });
  };

  const onBodySaved = (id: string, body: string) => {
    const next = entries.map((entry) =>
      entry.id === id
        ? {
            ...entry,
            body,
            customBody: entry.source === "manual" ? entry.customBody : true,
          }
        : entry,
    );
    setEntries(next);
    setNarrative(buildJournalNarrative(next));
  };

  return (
    <section className={styles.section}>
      <header className={styles.header}>
        <div className={styles.headerText}>
          <h2 className={styles.title}>Dagbok</h2>
          <p className={styles.subtitle}>
            {narrative
              ? "Din dag i löpande text"
              : "Skriv anteckningar — gym, jobb och uppgifter vävs in automatiskt."}
          </p>
        </div>
        <span className={styles.badge} aria-hidden>
          📓
        </span>
      </header>

      {narrative ? (
        <Card className={styles.narrativeCard}>
          <p className={styles.narrative}>{narrative}</p>
        </Card>
      ) : (
        <Card className={styles.emptyCard}>
          <p className={styles.emptyText}>
            Inga händelser ännu. Logga gym, jobb start/slut eller skriv en egen
            anteckning — då formas dagboken som en sammanhängande text.
          </p>
        </Card>
      )}

      {entries.length > 0 ? (
        <div className={styles.detailsWrap}>
          <button
            type="button"
            className={styles.detailsToggle}
            onClick={() => setShowDetails((v) => !v)}
            aria-expanded={showDetails}
          >
            {showDetails ? "Dölj detaljer" : `Visa detaljer (${entries.length})`}
          </button>
          {showDetails ? (
            <>
              <p className={styles.reorderHint}>
                Flytta upp eller ner för att ändra ordningen i dagboken.
              </p>
              <ol className={styles.timeline}>
                {entries.map((entry, index) => (
                  <JournalEntryRow
                    key={entry.id}
                    entry={entry}
                    date={date}
                    index={index}
                    total={entries.length}
                    pending={pending || reorderBusy}
                    onMoveUp={() => moveEntry(index, -1)}
                    onMoveDown={() => moveEntry(index, 1)}
                    onBodySaved={onBodySaved}
                  />
                ))}
              </ol>
            </>
          ) : null}
        </div>
      ) : null}

      <Card className={styles.composeCard}>
        <label className={styles.composeLabel} htmlFor={`journal-draft-${date}`}>
          Egen anteckning
        </label>
        <textarea
          id={`journal-draft-${date}`}
          className={styles.textarea}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Vad mer hände idag?"
          rows={3}
          maxLength={2000}
          disabled={pending}
        />
        {error ? <p className={styles.error}>{error}</p> : null}
        <div className={styles.composeActions}>
          <Button
            type="button"
            variant="primary"
            size="md"
            onClick={addEntry}
            loading={pending}
            disabled={!draft.trim()}
          >
            Lägg till
          </Button>
        </div>
      </Card>
    </section>
  );
}

interface JournalEntryRowProps {
  entry: JournalDisplayEntry;
  date: string;
  index: number;
  total: number;
  pending: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onBodySaved: (id: string, body: string) => void;
}

function JournalEntryRow({
  entry,
  date,
  index,
  total,
  pending,
  onMoveUp,
  onMoveDown,
  onBodySaved,
}: JournalEntryRowProps) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [body, setBody] = useState(entry.body);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rowPending, startTransition] = useTransition();

  useEffect(() => {
    setBody(entry.body);
  }, [entry.body]);

  useSyncNavPending(rowPending, entry.body);

  const save = () => {
    setError(null);
    startTransition(async () => {
      const res = await updateJournalEntryAction({
        id: entry.id,
        body,
        localDate: date,
        source: entry.source,
      });
      if (!res.ok) {
        setError(res.error ?? "Kunde inte spara.");
        return;
      }
      const trimmed = body.trim();
      onBodySaved(entry.id, trimmed);
      setBody(trimmed);
      setEditing(false);
      router.refresh();
    });
  };

  const remove = () => {
    setError(null);
    startTransition(async () => {
      const res = await deleteJournalEntryAction(entry.id);
      if (!res.ok) {
        setError(res.error ?? "Kunde inte ta bort.");
        setConfirmDelete(false);
        return;
      }
      router.refresh();
    });
  };

  const sourceLabel = JOURNAL_SOURCE_LABEL[entry.source];
  const busy = pending || rowPending;

  return (
    <li
      className={[
        styles.entry,
        entry.editable ? styles.entryManual : styles.entryAuto,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className={styles.reorderControls}>
        <button
          type="button"
          className={styles.reorderBtn}
          onClick={onMoveUp}
          disabled={busy || index === 0}
          aria-label={`Flytta upp ${entry.title}`}
          title="Flytta upp"
        >
          ↑
        </button>
        <button
          type="button"
          className={styles.reorderBtn}
          onClick={onMoveDown}
          disabled={busy || index === total - 1}
          aria-label={`Flytta ner ${entry.title}`}
          title="Flytta ner"
        >
          ↓
        </button>
      </div>

      <div className={styles.entryRail} aria-hidden>
        <span className={styles.entryDot} />
      </div>

      <div className={styles.entryBody}>
        <div className={styles.entryMeta}>
          <span className={styles.entryIcon} aria-hidden>
            {entry.icon}
          </span>
          <span className={styles.entryTitle}>{entry.title}</span>
          <span className={styles.entrySource}>{sourceLabel}</span>
          <time className={styles.entryTime} dateTime={entry.at}>
            {formatTime(entry.at)}
          </time>
        </div>

        {editing ? (
          <div className={styles.editBlock}>
            <textarea
              className={styles.textarea}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={3}
              maxLength={2000}
              disabled={busy}
            />
            {error ? <p className={styles.error}>{error}</p> : null}
            <div className={styles.entryActions}>
              <Button
                type="button"
                variant="ghost"
                size="md"
                onClick={() => {
                  setEditing(false);
                  setBody(entry.body);
                  setError(null);
                }}
                disabled={busy}
              >
                Avbryt
              </Button>
              <Button
                type="button"
                variant="primary"
                size="md"
                onClick={save}
                loading={rowPending}
                disabled={!body.trim()}
              >
                Spara
              </Button>
            </div>
          </div>
        ) : (
          <>
            <p className={styles.entryText}>{entry.body || "—"}</p>
            {error ? <p className={styles.error}>{error}</p> : null}
            <div className={styles.entryActions}>
              {confirmDelete ? (
                <>
                  <span className={styles.confirmLabel}>Ta bort?</span>
                  <button
                    type="button"
                    className={styles.linkBtnDanger}
                    onClick={remove}
                    disabled={busy}
                  >
                    Ja
                  </button>
                  <button
                    type="button"
                    className={styles.linkBtn}
                    onClick={() => setConfirmDelete(false)}
                    disabled={busy}
                  >
                    Nej
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    className={styles.linkBtn}
                    onClick={() => setEditing(true)}
                    disabled={busy}
                  >
                    Redigera
                  </button>
                  {entry.editable ? (
                    <button
                      type="button"
                      className={styles.linkBtnDanger}
                      onClick={() => setConfirmDelete(true)}
                      disabled={busy}
                    >
                      Ta bort
                    </button>
                  ) : (
                    <span className={styles.autoTag}>Automatisk</span>
                  )}
                </>
              )}
            </div>
          </>
        )}
      </div>
    </li>
  );
}
