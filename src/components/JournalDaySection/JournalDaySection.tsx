"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  addJournalEntryAction,
  deleteJournalEntryAction,
  updateJournalEntryAction,
} from "@/app/(app)/journal-actions";
import { Button } from "@/components/Button/Button";
import { Card } from "@/components/Card/Card";
import { formatTime } from "@/lib/date";
import {
  JOURNAL_SOURCE_LABEL,
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
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

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

  return (
    <section className={styles.section}>
      <header className={styles.header}>
        <div className={styles.headerText}>
          <h2 className={styles.title}>Dagbok</h2>
          <p className={styles.subtitle}>
            {journal.narrative
              ? "Din dag i löpande text"
              : "Skriv anteckningar — gym, jobb och uppgifter vävs in automatiskt."}
          </p>
        </div>
        <span className={styles.badge} aria-hidden>
          📓
        </span>
      </header>

      {journal.narrative ? (
        <Card className={styles.narrativeCard}>
          <p className={styles.narrative}>{journal.narrative}</p>
        </Card>
      ) : (
        <Card className={styles.emptyCard}>
          <p className={styles.emptyText}>
            Inga händelser ännu. Logga gym, jobb start/slut eller skriv en egen
            anteckning — då formas dagboken som en sammanhängande text.
          </p>
        </Card>
      )}

      {journal.entries.length > 0 ? (
        <div className={styles.detailsWrap}>
          <button
            type="button"
            className={styles.detailsToggle}
            onClick={() => setShowDetails((v) => !v)}
            aria-expanded={showDetails}
          >
            {showDetails ? "Dölj detaljer" : `Visa detaljer (${journal.entries.length})`}
          </button>
          {showDetails ? (
            <ol className={styles.timeline}>
              {journal.entries.map((entry) => (
                <JournalEntryRow key={entry.id} entry={entry} />
              ))}
            </ol>
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

function JournalEntryRow({ entry }: { entry: JournalDisplayEntry }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [body, setBody] = useState(entry.body);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const save = () => {
    setError(null);
    startTransition(async () => {
      const res = await updateJournalEntryAction({ id: entry.id, body });
      if (!res.ok) {
        setError(res.error ?? "Kunde inte spara.");
        return;
      }
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

  return (
    <li
      className={[
        styles.entry,
        entry.editable ? styles.entryManual : styles.entryAuto,
      ]
        .filter(Boolean)
        .join(" ")}
    >
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
              disabled={pending}
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
                disabled={pending}
              >
                Avbryt
              </Button>
              <Button
                type="button"
                variant="primary"
                size="md"
                onClick={save}
                loading={pending}
              >
                Spara
              </Button>
            </div>
          </div>
        ) : (
          <>
            <p className={styles.entryText}>{entry.body || "—"}</p>
            {error ? <p className={styles.error}>{error}</p> : null}
            {entry.editable ? (
              <div className={styles.entryActions}>
                {confirmDelete ? (
                  <>
                    <span className={styles.confirmLabel}>Ta bort?</span>
                    <button
                      type="button"
                      className={styles.linkBtnDanger}
                      onClick={remove}
                      disabled={pending}
                    >
                      Ja
                    </button>
                    <button
                      type="button"
                      className={styles.linkBtn}
                      onClick={() => setConfirmDelete(false)}
                      disabled={pending}
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
                      disabled={pending}
                    >
                      Redigera
                    </button>
                    <button
                      type="button"
                      className={styles.linkBtnDanger}
                      onClick={() => setConfirmDelete(true)}
                      disabled={pending}
                    >
                      Ta bort
                    </button>
                  </>
                )}
              </div>
            ) : (
              <span className={styles.autoTag}>Automatisk</span>
            )}
          </>
        )}
      </div>
    </li>
  );
}
