"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/Button/Button";
import { Card } from "@/components/Card/Card";
import { Input } from "@/components/Input/Input";
import { WaterBottle } from "@/components/WaterBottle/WaterBottle";
import { CARD_QUICK_ADDS, formatMl, type WaterSummary } from "@/lib/water";
import { logWaterAction } from "@/app/(app)/actions";
import styles from "./WaterHeroCard.module.scss";

interface Props {
  summary: WaterSummary;
  /** Show a "+" badge in the top-right corner linking to this URL. */
  plusHref?: string;
  /** Accessible label for the + button. */
  plusLabel?: string;
}

export function WaterHeroCard({ summary, plusHref, plusLabel }: Props) {
  const router = useRouter();
  const drinkRef = useRef<HTMLInputElement>(null);
  const [selectedMl, setSelectedMl] = useState<number | null>(null);
  const [drink, setDrink] = useState("");
  const [busyMl, setBusyMl] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const extraRef = useRef(0);
  const [extraMl, setExtraMl] = useState(0);
  const serverTotalRef = useRef(summary.totalMl);
  const serverDateRef = useRef(summary.date);

  const setExtra = (ml: number) => {
    extraRef.current = ml;
    setExtraMl(ml);
  };

  useEffect(() => {
    if (summary.date !== serverDateRef.current) {
      serverDateRef.current = summary.date;
      serverTotalRef.current = summary.totalMl;
      setExtra(0);
      return;
    }

    const delta = summary.totalMl - serverTotalRef.current;
    serverTotalRef.current = summary.totalMl;
    if (delta > 0) setExtra(Math.max(0, extraRef.current - delta));
    else if (delta < 0) setExtra(0);
  }, [summary.date, summary.totalMl]);

  const totalMl = summary.totalMl + extraMl;
  const progress = summary.goalMl > 0 ? totalMl / summary.goalMl : 0;

  useEffect(() => {
    if (selectedMl != null) drinkRef.current?.focus();
  }, [selectedMl]);

  const choose = (ml: number) => {
    if (pending) return;
    setError(null);
    setSelectedMl((current) => (current === ml ? null : ml));
  };

  const cancelDrink = () => {
    if (pending) return;
    setSelectedMl(null);
    setError(null);
  };

  const add = (ml: number, note: string) => {
    const trimmed = note.trim();
    if (!trimmed) {
      setError("Skriv vad du dricker.");
      drinkRef.current?.focus();
      return;
    }

    setError(null);
    setBusyMl(ml);
    setExtra(extraRef.current + ml);
    startTransition(async () => {
      const res = await logWaterAction({
        amountMl: ml,
        localDate: summary.date,
        note: trimmed,
      });
      setBusyMl((current) => (current === ml ? null : current));
      if (!res.ok) {
        setExtra(Math.max(0, extraRef.current - ml));
        setError(res.error ?? "Could not log.");
        return;
      }
      setDrink("");
      setSelectedMl(null);
      router.refresh();
    });
  };

  return (
    // overflow:visible lets the hover glow + pulse ring escape the card edge
    // without being clipped by Card.module.scss's overflow:hidden.
    <Card className={styles.card} style={{ overflow: "visible" }}>
      {plusHref ? (
        <Link
          href={plusHref}
          className={styles.plusBtn}
          aria-label={plusLabel ?? "Open water page"}
          title={plusLabel ?? "Water page"}
        >
          <span className={styles.plusPulse} aria-hidden />
          <span className={styles.plusPulse2} aria-hidden />
          <svg
            className={styles.plusIcon}
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden
          >
            <path
              d="M12 5v14M5 12h14"
              stroke="currentColor"
              strokeWidth="2.6"
              strokeLinecap="round"
            />
          </svg>
        </Link>
      ) : null}

      {plusHref ? (
        <Link
          href={plusHref}
          className={styles.logBtn}
          aria-label="Se allt du drack idag"
          title="Se allt du drack idag"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path
              d="M9 6h11M9 12h11M9 18h11"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
            />
            <path
              d="M4 6h.01M4 12h.01M4 18h.01"
              stroke="currentColor"
              strokeWidth="3.2"
              strokeLinecap="round"
            />
          </svg>
        </Link>
      ) : null}

      <WaterBottle
        progress={progress}
        totalMl={totalMl}
        goalMl={summary.goalMl}
      >
        <div className={styles.quickRow} role="group" aria-label="Add water">
          {CARD_QUICK_ADDS.map((ml) => (
            <button
              key={ml}
              type="button"
              className={styles.quickBtn}
              onClick={() => choose(ml)}
              aria-pressed={selectedMl === ml}
              aria-expanded={selectedMl === ml}
              aria-busy={busyMl === ml}
              disabled={pending}
            >
              {formatMl(ml)}
            </button>
          ))}
        </div>

        {selectedMl != null ? (
          <form
            className={styles.drinkForm}
            onSubmit={(event) => {
              event.preventDefault();
              add(selectedMl, drink);
            }}
          >
            <Input
              ref={drinkRef}
              label={`${formatMl(selectedMl)} — vad dricker du?`}
              type="text"
              value={drink}
              onChange={(event) => setDrink(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Escape") cancelDrink();
              }}
              placeholder="Vatten, kaffe, te…"
              maxLength={120}
              autoComplete="off"
              required
            />
            <div className={styles.drinkActions}>
              <Button type="button" variant="ghost" size="md" onClick={cancelDrink} disabled={pending}>
                Avbryt
              </Button>
              <Button type="submit" size="md" loading={pending}>
                Lägg till
              </Button>
            </div>
          </form>
        ) : null}

        {error ? <p className={styles.error}>{error}</p> : null}
      </WaterBottle>
    </Card>
  );
}
