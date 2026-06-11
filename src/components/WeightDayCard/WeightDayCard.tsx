"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  clearWeightLogAction,
  saveWeightLogAction,
} from "@/app/(app)/weight-actions";
import { Button } from "@/components/Button/Button";
import { Card } from "@/components/Card/Card";
import { formatWeightKg } from "@/lib/format";
import {
  WEIGHT_TIME_LABEL,
  WEIGHT_TIMES_OF_DAY,
  type WeightDayContext,
  type WeightTimeOfDay,
} from "@/lib/weight";
import styles from "./WeightDayCard.module.scss";

interface Props {
  context: WeightDayContext;
  title?: string;
}

export function WeightDayCard({ context, title = "Vikt" }: Props) {
  if (!context.scheduled) return null;

  return (
    <Card className={styles.card}>
      <WeightDayCardContent context={context} title={title} />
    </Card>
  );
}

function WeightDayCardContent({
  context,
  title,
}: {
  context: WeightDayContext;
  title: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [timeOfDay, setTimeOfDay] = useState<WeightTimeOfDay | null>(
    context.log?.timeOfDay ?? null,
  );
  const [weightKg, setWeightKg] = useState(
    context.log ? String(context.log.weightKg) : "",
  );

  useEffect(() => {
    setTimeOfDay(context.log?.timeOfDay ?? null);
    setWeightKg(context.log ? String(context.log.weightKg) : "");
  }, [context.log]);

  const logged = Boolean(context.log);

  const save = () => {
    if (!timeOfDay) {
      setError("Välj om du vägde dig på morgon, dag eller kväll.");
      return;
    }

    const parsed = Number(weightKg.replace(",", "."));
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setError("Ange din vikt i kg.");
      return;
    }

    setError(null);
    startTransition(async () => {
      const res = await saveWeightLogAction({
        localDate: context.localDate,
        timeOfDay,
        weightKg: parsed,
      });
      if (!res.ok) setError(res.error ?? "Kunde inte spara.");
      router.refresh();
    });
  };

  const clear = () => {
    setError(null);
    startTransition(async () => {
      const res = await clearWeightLogAction(context.localDate);
      if (!res.ok) {
        setError(res.error ?? "Kunde inte ta bort.");
        return;
      }
      setTimeOfDay(null);
      setWeightKg("");
      router.refresh();
    });
  };

  return (
    <>
      <header className={styles.header}>
        <div className={styles.titleRow}>
          <h2 className={styles.title}>{title}</h2>
          {logged && context.log ? (
            <span className={styles.loggedValue}>
              {formatWeightKg(context.log.weightKg)}
            </span>
          ) : null}
        </div>
        <Link
          href={`/week?start=${context.weekStart}&view=plan`}
          className={styles.weekLink}
        >
          Veckoplan →
        </Link>
        {logged && context.log ? (
          <p className={styles.loggedMeta}>
            {WEIGHT_TIME_LABEL[context.log.timeOfDay]}
          </p>
        ) : null}
      </header>

      {error ? <p className={styles.error}>{error}</p> : null}

      <div className={styles.form}>
        <div>
          <p className={styles.actionsLabel}>När vägde du dig?</p>
          <div className={styles.timeRow} role="radiogroup" aria-label="Tid på dagen">
            {WEIGHT_TIMES_OF_DAY.map((t) => (
              <button
                key={t}
                type="button"
                role="radio"
                aria-checked={timeOfDay === t}
                className={[
                  styles.timeBtn,
                  timeOfDay === t ? styles.timeBtnActive : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                onClick={() => setTimeOfDay(t)}
                disabled={pending}
              >
                {WEIGHT_TIME_LABEL[t]}
              </button>
            ))}
          </div>
        </div>

        <div className={styles.weightInputWrap}>
          <label className={styles.weightLabel} htmlFor="weight-kg">
            Vikt
          </label>
          <div className={styles.weightField}>
            <input
              id="weight-kg"
              className={styles.weightInput}
              type="number"
              inputMode="decimal"
              min={20}
              max={500}
              step={0.1}
              placeholder="75,0"
              value={weightKg}
              onChange={(e) => setWeightKg(e.target.value)}
              disabled={pending}
            />
            <span className={styles.weightSuffix}>kg</span>
          </div>
        </div>

        <Button
          type="button"
          variant="primary"
          size="md"
          fullWidth
          loading={pending}
          disabled={pending}
          onClick={save}
        >
          {logged ? "Uppdatera vikt" : "Spara vikt"}
        </Button>

        {logged ? (
          <button
            type="button"
            className={styles.undoBtn}
            onClick={clear}
            disabled={pending}
          >
            Ta bort vägning
          </button>
        ) : null}
      </div>
    </>
  );
}
