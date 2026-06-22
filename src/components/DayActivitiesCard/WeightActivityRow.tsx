"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  clearWeightLogAction,
  saveWeightLogAction,
} from "@/app/(app)/weight-actions";
import { Button } from "@/components/Button/Button";
import { Input } from "@/components/Input/Input";
import { formatWeightKg } from "@/lib/format";
import {
  WEIGHT_TIME_LABEL,
  WEIGHT_TIMES_OF_DAY,
  type WeightDayContext,
  type WeightTimeOfDay,
} from "@/lib/weight";
import { ActivityCategoryBadge } from "@/components/ActivityCategoryBadge/ActivityCategoryBadge";
import { trainingCategory } from "@/lib/activity-category";
import styles from "@/components/GymDayCard/GymDayCard.module.scss";

interface Props {
  context: WeightDayContext;
  expanded: boolean;
  busy: boolean;
  pending: boolean;
  onToggleExpand: () => void;
  onError: (msg: string | null) => void;
  onPendingId: (id: string | null) => void;
  onDone: () => void;
}

export function WeightActivityRow({
  context,
  expanded,
  busy,
  pending,
  onToggleExpand,
  onError,
  onPendingId,
  onDone,
}: Props) {
  const router = useRouter();
  const logged = Boolean(context.log);
  const done = logged;
  const category = trainingCategory("weight");
  const [timeOfDay, setTimeOfDay] = useState<WeightTimeOfDay | null>(
    context.log?.timeOfDay ?? null,
  );
  const [weightKg, setWeightKg] = useState(
    context.log ? String(context.log.weightKg) : "",
  );
  const [, startTransition] = useTransition();

  useEffect(() => {
    setTimeOfDay(context.log?.timeOfDay ?? null);
    setWeightKg(context.log ? String(context.log.weightKg) : "");
  }, [context.log]);

  const save = () => {
    if (!timeOfDay) {
      onError("Välj om du vägde dig på morgon, dag eller kväll.");
      return;
    }
    const parsed = Number(weightKg.replace(",", "."));
    if (!Number.isFinite(parsed) || parsed <= 0) {
      onError("Ange din vikt i kg.");
      return;
    }
    onError(null);
    onPendingId("weight");
    startTransition(async () => {
      const res = await saveWeightLogAction({
        localDate: context.localDate,
        timeOfDay,
        weightKg: parsed,
      });
      if (!res.ok) onError(res.error ?? "Kunde inte spara.");
      onPendingId(null);
      onDone();
      router.refresh();
    });
  };

  const clear = () => {
    onError(null);
    onPendingId("weight");
    startTransition(async () => {
      const res = await clearWeightLogAction(context.localDate);
      if (!res.ok) onError(res.error ?? "Kunde inte ta bort.");
      setTimeOfDay(null);
      setWeightKg("");
      onPendingId(null);
      onDone();
      router.refresh();
    });
  };

  return (
    <li
      className={[
        styles.session,
        done ? styles.sessionDone : "",
        busy ? styles.sessionBusy : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <button
        type="button"
        className={[styles.checkBtn, done ? styles.checkBtnDone : ""]
          .filter(Boolean)
          .join(" ")}
        aria-label={done ? "Vikt loggad" : "Logga vikt"}
        onClick={onToggleExpand}
        disabled={pending}
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
        className={styles.sessionBody}
        onClick={onToggleExpand}
        aria-expanded={expanded}
        disabled={pending}
      >
        <span className={styles.sessionIcon} aria-hidden style={{ borderColor: "#c084fc" }}>
          ⚖️
        </span>
        <span className={styles.sessionMeta}>
          <ActivityCategoryBadge
            icon={category.icon}
            label={category.label}
            accent={category.accent}
            done={done}
          />
          <span className={styles.sessionTitle}>Vikt</span>
          {logged && context.log ? (
            <span className={styles.sessionDesc}>
              {formatWeightKg(context.log.weightKg)} ·{" "}
              {WEIGHT_TIME_LABEL[context.log.timeOfDay]}
            </span>
          ) : (
            <span className={styles.sessionDesc}>Veckovägning</span>
          )}
        </span>
        <span
          className={[styles.chevron, expanded ? styles.chevronUp : ""]
            .filter(Boolean)
            .join(" ")}
          aria-hidden
        >
          ▾
        </span>
      </button>

      {expanded ? (
        <div className={styles.sessionActions}>
          <p className={styles.actionsLabel}>När vägde du dig?</p>
          <div className={styles.warmupRow}>
            {WEIGHT_TIMES_OF_DAY.map((t) => (
              <button
                key={t}
                type="button"
                className={[
                  styles.warmupBtn,
                  timeOfDay === t ? styles.warmupBtnActive : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                aria-pressed={timeOfDay === t}
                onClick={() => setTimeOfDay(t)}
                disabled={pending}
              >
                {WEIGHT_TIME_LABEL[t]}
              </button>
            ))}
          </div>
          <Input
            label="Vikt (kg)"
            type="number"
            inputMode="decimal"
            value={weightKg}
            onChange={(e) => setWeightKg(e.target.value)}
            placeholder="75,0"
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
      ) : null}
    </li>
  );
}
