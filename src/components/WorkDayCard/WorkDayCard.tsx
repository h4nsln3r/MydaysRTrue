"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  logWorkEndAction,
  logWorkStartAction,
  updateWorkNotesAction,
} from "@/app/(app)/work-actions";
import { Button } from "@/components/Button/Button";
import { Card } from "@/components/Card/Card";
import { Input } from "@/components/Input/Input";
import { formatTime } from "@/lib/date";
import {
  shouldShowWork,
  workNeedsEnd,
  WORK_KINDS,
  WORK_KIND_FULL_LABEL,
  WORK_KIND_ICON,
  type WorkDailyLog,
  type WorkKind,
} from "@/lib/work";
import styles from "./WorkDayCard.module.scss";

interface Props {
  date: string;
  work: WorkDailyLog;
  onLeave?: boolean;
}

export function WorkDayCard({ date, work, onLeave = false }: Props) {
  const router = useRouter();
  const [startNote, setStartNote] = useState(work.startNote ?? "");
  const [endNote, setEndNote] = useState(work.endNote ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    setStartNote(work.startNote ?? "");
    setEndNote(work.endNote ?? "");
  }, [work.startNote, work.endNote]);

  if (!shouldShowWork(date, onLeave)) return null;

  const started = Boolean(work.startedAt);
  const ended = Boolean(work.endedAt);
  const showEnd = workNeedsEnd(work);

  const logStart = (kind: WorkKind) => {
    setError(null);
    startTransition(async () => {
      const res = await logWorkStartAction({
        localDate: date,
        kind,
        note: startNote,
      });
      if (!res.ok) setError(res.error ?? "Kunde inte spara.");
      router.refresh();
    });
  };

  const logEnd = () => {
    setError(null);
    startTransition(async () => {
      const res = await logWorkEndAction({ localDate: date, note: endNote });
      if (!res.ok) setError(res.error ?? "Kunde inte spara.");
      router.refresh();
    });
  };

  const saveNotes = () => {
    setError(null);
    startTransition(async () => {
      const res = await updateWorkNotesAction({
        localDate: date,
        startNote,
        endNote,
      });
      if (!res.ok) setError(res.error ?? "Kunde inte spara.");
      router.refresh();
    });
  };

  return (
    <Card className={styles.card}>
      <header className={styles.header}>
        <div className={styles.identity}>
          <span className={styles.icon} aria-hidden>
            💼
          </span>
          <div>
            <h2 className={styles.title}>Jobb</h2>
            <p className={styles.subtitle}>
              {work.kind === "off"
                ? "Ledig"
                : work.kind === "sick"
                  ? "Sjuk"
                  : ended
                    ? "Dagen avslutad"
                    : started
                      ? work.kind
                        ? WORK_KIND_FULL_LABEL[work.kind]
                        : "På jobbet"
                      : "Välj hur dagen ser ut"}
            </p>
          </div>
        </div>
      </header>

      {error ? <p className={styles.error}>{error}</p> : null}

      <div className={styles.blocks}>
        <section className={styles.block}>
          <div className={styles.blockHead}>
            <h3 className={styles.blockTitle}>Jobb start</h3>
            {work.startedAt ? (
              <time className={styles.blockTime} dateTime={work.startedAt}>
                {formatTime(work.startedAt)}
              </time>
            ) : null}
          </div>
          <Input
            label="Kommentar"
            value={startNote}
            onChange={(e) => setStartNote(e.target.value)}
            placeholder="t.ex. på kontoret, hemifrån"
            maxLength={500}
            disabled={pending || started}
          />
          {!started ? (
            <div className={styles.kindGrid}>
              {WORK_KINDS.map((kind) => (
                <Button
                  key={kind}
                  type="button"
                  variant="outline"
                  size="md"
                  onClick={() => logStart(kind)}
                  loading={pending}
                >
                  {WORK_KIND_ICON[kind]} {WORK_KIND_FULL_LABEL[kind]}
                </Button>
              ))}
            </div>
          ) : null}
        </section>

        {showEnd ? (
          <section className={styles.block}>
            <div className={styles.blockHead}>
              <h3 className={styles.blockTitle}>Jobb slut</h3>
              {work.endedAt ? (
                <time className={styles.blockTime} dateTime={work.endedAt}>
                  {formatTime(work.endedAt)}
                </time>
              ) : null}
            </div>
            <Input
              label="Kommentar"
              value={endNote}
              onChange={(e) => setEndNote(e.target.value)}
              placeholder="t.ex. det var lugnt idag"
              maxLength={500}
              disabled={pending || !started}
            />
            {started && !ended ? (
              <Button
                type="button"
                variant="primary"
                size="md"
                fullWidth
                onClick={logEnd}
                loading={pending}
              >
                Logga slut
              </Button>
            ) : null}
          </section>
        ) : null}
      </div>

      {(started || ended) && (startNote !== (work.startNote ?? "") || endNote !== (work.endNote ?? "")) ? (
        <Button
          type="button"
          variant="outline"
          size="md"
          fullWidth
          onClick={saveNotes}
          loading={pending}
        >
          Spara kommentarer
        </Button>
      ) : null}
    </Card>
  );
}
