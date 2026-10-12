"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addJournalEntryAction } from "@/app/(app)/journal-actions";
import { Button } from "@/components/Button/Button";
import { Card } from "@/components/Card/Card";
import { useSyncNavPending } from "@/components/NavProgress/NavProgress";
import styles from "./JournalDaySection.module.scss";

export function JournalNoteForm({ date }: { date: string }) {
  const router = useRouter();
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useSyncNavPending(pending, draft);

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
  );
}
