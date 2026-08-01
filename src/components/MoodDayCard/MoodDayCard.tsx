"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveMoodDailyLogAction } from "@/app/(app)/mood-actions";
import { Button } from "@/components/Button/Button";
import { Card } from "@/components/Card/Card";
import { Input } from "@/components/Input/Input";
import type { DailyHabit } from "@/lib/habits";
import {
  MOOD_ICON,
  MOOD_LABEL,
  MOOD_OPTIONS,
  type DailyMoodContext,
  type MoodKey,
} from "@/lib/mood";
import styles from "./MoodDayCard.module.scss";

interface Props {
  date: string;
  habit: DailyHabit;
  mood: DailyMoodContext;
}

export function MoodDayCard({ date, habit, mood }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<MoodKey | null>(mood.mood);
  const [note, setNote] = useState(mood.note ?? "");
  /** True while a newly picked mood awaits Spara / Hoppa över. */
  const [drafting, setDrafting] = useState(false);

  useEffect(() => {
    setSelected(mood.mood);
    setNote(mood.note ?? "");
    setDrafting(false);
  }, [mood.mood, mood.note]);

  const persist = (nextMood: MoodKey | null, nextNote: string | null) => {
    setError(null);
    startTransition(async () => {
      const res = await saveMoodDailyLogAction({
        localDate: date,
        mood: nextMood,
        note: nextMood ? nextNote : null,
      });
      if (!res.ok) {
        setError(res.error ?? "Kunde inte spara.");
        setSelected(mood.mood);
        setNote(mood.note ?? "");
        setDrafting(false);
        return;
      }
      setDrafting(false);
      router.refresh();
    });
  };

  const pick = (key: MoodKey) => {
    if (pending) return;

    // Cancel an unfinished draft by tapping the same mood again.
    if (drafting && selected === key) {
      setSelected(mood.mood);
      setNote(mood.note ?? "");
      setDrafting(false);
      setError(null);
      return;
    }

    // Clear an already saved mood.
    if (!drafting && selected === key && mood.mood === key) {
      setSelected(null);
      setNote("");
      persist(null, null);
      return;
    }

    setSelected(key);
    setDrafting(true);
    setError(null);
    if (mood.mood !== key) {
      // Keep existing note when re-opening same day; clear only if none saved yet
      // and user is switching away from a previous draft of another mood with empty note.
      if (!mood.note) setNote("");
      else setNote(mood.note);
    }
  };

  const saveWithNote = () => {
    if (!selected) return;
    persist(selected, note);
  };

  const skipNote = () => {
    if (!selected) return;
    setNote("");
    persist(selected, null);
  };

  const savedNoteDirty =
    !drafting &&
    selected != null &&
    mood.mood === selected &&
    note.trim() !== (mood.note ?? "").trim();

  const showComment = selected != null;
  const showDraftActions = drafting && selected != null;
  const showEditSave = savedNoteDirty;

  return (
    <Card
      className={[
        styles.card,
        habit.status ? styles[`card_${habit.status}`] : "",
        pending ? styles.cardBusy : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className={styles.header}>
        <div className={styles.identity}>
          <span
            className={styles.icon}
            aria-hidden
            style={{ borderColor: habit.accent }}
          >
            {selected ? MOOD_ICON[selected] : habit.icon}
          </span>
          <div className={styles.titleBlock}>
            <span className={styles.label}>{habit.label}</span>
            <span className={styles.subtitle}>
              {selected
                ? drafting
                  ? `${MOOD_LABEL[selected]} — lägg till kommentar?`
                  : MOOD_LABEL[selected]
                : "Hur kändes dagen?"}
            </span>
          </div>
        </div>
      </div>

      <div className={styles.options} role="radiogroup" aria-label={habit.label}>
        {MOOD_OPTIONS.map((option) => {
          const active = selected === option.key;
          return (
            <button
              key={option.key}
              type="button"
              role="radio"
              aria-checked={active}
              aria-label={option.label}
              title={option.label}
              className={[styles.option, active ? styles.optionActive : ""]
                .filter(Boolean)
                .join(" ")}
              onClick={() => pick(option.key)}
              disabled={pending}
            >
              <span className={styles.optionIcon} aria-hidden>
                {option.icon}
              </span>
              <span className={styles.optionLabel}>{option.label}</span>
            </button>
          );
        })}
      </div>

      {showComment ? (
        <div className={styles.comment}>
          <Input
            label="Kommentar (valfritt)"
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="t.ex. Jobbigt möte, men fin kväll"
            maxLength={280}
            disabled={pending}
          />
          {showDraftActions ? (
            <div className={styles.actions}>
              <Button
                type="button"
                variant="primary"
                size="md"
                loading={pending}
                disabled={pending}
                onClick={saveWithNote}
              >
                Spara
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="md"
                disabled={pending}
                onClick={skipNote}
              >
                Hoppa över
              </Button>
            </div>
          ) : null}
          {showEditSave ? (
            <div className={styles.actions}>
              <Button
                type="button"
                variant="primary"
                size="md"
                loading={pending}
                disabled={pending}
                onClick={saveWithNote}
              >
                Spara kommentar
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}

      {error ? <p className={styles.error}>{error}</p> : null}
    </Card>
  );
}
