"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/Card/Card";
import { Button } from "@/components/Button/Button";
import { Input } from "@/components/Input/Input";
import {
  INTAKE_DESCRIPTION_LABEL,
  INTAKE_DESCRIPTION_PLACEHOLDER,
  INTAKE_EMPTY_HINT,
  INTAKE_HAS_WATER,
  INTAKE_ICON,
  INTAKE_LABEL,
  INTAKE_REQUIRES_DESCRIPTION,
  applicableIntakeKinds,
  type IntakeEntry,
  type IntakeKind,
} from "@/lib/intake";
import { formatMl } from "@/lib/water";
import {
  clearIntakeAction,
  saveIntakeAction,
} from "@/app/(app)/intake-actions";
import styles from "./IntakeCard.module.scss";

interface Props {
  date: string;
  intake: Record<IntakeKind, IntakeEntry | null>;
}

const WATER_PRESETS = [200, 330, 500];

export function IntakeCard({ date, intake }: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState<IntakeKind | null>(null);
  const [pending, startTransition] = useTransition();
  const [confirmingClear, setConfirmingClear] = useState<IntakeKind | null>(null);

  const kinds = applicableIntakeKinds(date);
  const logged = kinds.filter((k) => intake[k]).length;
  const total = kinds.length;

  const close = () => setEditing(null);
  const onSaved = () => {
    close();
    router.refresh();
  };

  const clear = (kind: IntakeKind) => {
    startTransition(async () => {
      const res = await clearIntakeAction({ kind, localDate: date });
      if (res.ok) {
        setConfirmingClear(null);
        router.refresh();
      }
    });
  };

  return (
    <Card className={styles.card}>
      <header className={styles.header}>
        <div className={styles.titleRow}>
          <h2 className={styles.title}>Intake</h2>
          <span
            className={[
              styles.counter,
              logged === total ? styles.counterDone : "",
              logged > 0 && logged < total ? styles.counterPartial : "",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            <span className={styles.counterBig}>{logged}</span>
            <span className={styles.counterSlash}>/ {total}</span>
          </span>
        </div>
        <p className={styles.subtitle}>
          Frukt, kreatin{kinds.length === 4 ? ", vitaminer och shake" : ""} för
          dagen.
        </p>
      </header>

      <ul className={styles.list}>
        {kinds.map((kind) => {
          const entry = intake[kind];
          const isEditing = editing === kind;
          const isConfirming = confirmingClear === kind;
          return (
            <li key={kind} className={styles.item}>
              {isEditing ? (
                <IntakeForm
                  kind={kind}
                  date={date}
                  initial={entry}
                  onCancel={close}
                  onSaved={onSaved}
                />
              ) : entry ? (
                <div className={[styles.row, styles.rowDone].join(" ")}>
                  <button
                    type="button"
                    className={styles.rowMain}
                    onClick={() => setEditing(kind)}
                    aria-label={`Edit ${INTAKE_LABEL[kind]}`}
                    disabled={pending}
                  >
                    <span
                      className={styles.iconBox}
                      aria-hidden
                      data-state="done"
                    >
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        aria-hidden
                      >
                        <path
                          d="M5 12.5 10 17.5 19 7.5"
                          stroke="currentColor"
                          strokeWidth="2.6"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </span>
                    <span className={styles.intakeText}>
                      <span className={styles.intakeLabel}>
                        <span className={styles.intakeIcon} aria-hidden>
                          {INTAKE_ICON[kind]}
                        </span>
                        {INTAKE_LABEL[kind]}
                      </span>
                      <span className={styles.description}>
                        {entry.description || (
                          <span className={styles.descriptionMuted}>Done</span>
                        )}
                      </span>
                    </span>
                    {entry.waterMl > 0 ? (
                      <span className={styles.waterBadge} aria-label="With water">
                        💧 {formatMl(entry.waterMl)}
                      </span>
                    ) : null}
                  </button>
                  <span className={styles.clearWrap}>
                    {isConfirming ? (
                      <span className={styles.confirmRow}>
                        <button
                          type="button"
                          className={styles.confirmYes}
                          onClick={() => clear(kind)}
                          disabled={pending}
                          aria-label="Confirm clear"
                        >
                          Clear
                        </button>
                        <button
                          type="button"
                          className={styles.confirmNo}
                          onClick={() => setConfirmingClear(null)}
                          disabled={pending}
                          aria-label="Cancel"
                        >
                          Cancel
                        </button>
                      </span>
                    ) : (
                      <button
                        type="button"
                        className={styles.clearBtn}
                        onClick={() => setConfirmingClear(kind)}
                        aria-label={`Remove ${INTAKE_LABEL[kind]}`}
                        disabled={pending}
                      >
                        ×
                      </button>
                    )}
                  </span>
                </div>
              ) : (
                <button
                  type="button"
                  className={[styles.row, styles.rowEmpty].join(" ")}
                  onClick={() => setEditing(kind)}
                  aria-label={`Log ${INTAKE_LABEL[kind]}`}
                  disabled={pending}
                >
                  <span className={styles.iconBox} aria-hidden data-state="empty" />
                  <span className={styles.intakeText}>
                    <span className={styles.intakeLabel}>
                      <span className={styles.intakeIcon} aria-hidden>
                        {INTAKE_ICON[kind]}
                      </span>
                      {INTAKE_LABEL[kind]}
                    </span>
                    <span className={styles.intakeHint}>
                      {INTAKE_EMPTY_HINT[kind]}
                    </span>
                  </span>
                  <span className={styles.plus} aria-hidden>
                    +
                  </span>
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

// ============================================================================
// Inline intake form
// ============================================================================

interface IntakeFormProps {
  kind: IntakeKind;
  date: string;
  initial: IntakeEntry | null;
  onCancel: () => void;
  onSaved: () => void;
}

function IntakeForm({ kind, date, initial, onCancel, onSaved }: IntakeFormProps) {
  const hasWater = INTAKE_HAS_WATER[kind];
  const requiresDescription = INTAKE_REQUIRES_DESCRIPTION[kind];

  const [description, setDescription] = useState(initial?.description ?? "");
  const [waterMl, setWaterMl] = useState<string>(
    initial?.waterMl ? String(initial.waterMl) : "",
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    let parsedWater = 0;
    if (hasWater) {
      parsedWater = waterMl.trim() === "" ? 0 : Number(waterMl);
      if (!Number.isFinite(parsedWater) || parsedWater < 0) {
        setError("Water must be a positive number.");
        return;
      }
    }

    startTransition(async () => {
      const res = await saveIntakeAction({
        kind,
        localDate: date,
        description,
        waterMl: hasWater ? Math.round(parsedWater) : 0,
      });
      if (!res.ok) {
        setError(res.error ?? "Could not save.");
        return;
      }
      onSaved();
    });
  };

  return (
    <form className={styles.form} onSubmit={submit}>
      <div className={styles.formHead}>
        <span className={styles.formTitle}>
          <span className={styles.intakeIcon} aria-hidden>
            {INTAKE_ICON[kind]}
          </span>
          {INTAKE_LABEL[kind]}
        </span>
        <button
          type="button"
          className={styles.formClose}
          onClick={onCancel}
          aria-label="Cancel"
          disabled={pending}
        >
          ×
        </button>
      </div>

      <Input
        label={INTAKE_DESCRIPTION_LABEL[kind]}
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder={INTAKE_DESCRIPTION_PLACEHOLDER[kind]}
        maxLength={280}
        autoFocus
        required={requiresDescription}
      />

      {hasWater ? (
        <div className={styles.waterBlock}>
          <span className={styles.label}>Water with this</span>
          <div className={styles.waterRow}>
            <Input
              type="number"
              min={0}
              max={5000}
              step={50}
              inputMode="numeric"
              value={waterMl}
              onChange={(e) => setWaterMl(e.target.value)}
              placeholder="0"
              suffix="ml"
            />
            <div className={styles.waterPresets}>
              {WATER_PRESETS.map((p) => (
                <button
                  key={p}
                  type="button"
                  className={styles.waterPreset}
                  aria-pressed={Number(waterMl) === p}
                  onClick={() => setWaterMl(String(p))}
                >
                  {p}
                </button>
              ))}
              {waterMl ? (
                <button
                  type="button"
                  className={[styles.waterPreset, styles.waterClear].join(" ")}
                  onClick={() => setWaterMl("")}
                  aria-label="Clear water"
                >
                  ×
                </button>
              ) : null}
            </div>
          </div>
          <p className={styles.hint}>Added to your water log automatically.</p>
        </div>
      ) : null}

      {error ? <p className={styles.error}>{error}</p> : null}

      <div className={styles.formActions}>
        <Button
          type="button"
          variant="ghost"
          size="md"
          onClick={onCancel}
          disabled={pending}
        >
          Cancel
        </Button>
        <Button type="submit" variant="primary" size="md" loading={pending}>
          {initial ? "Save" : "Mark done"}
        </Button>
      </div>
    </form>
  );
}
