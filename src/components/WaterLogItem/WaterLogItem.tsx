"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/Input/Input";
import { Button } from "@/components/Button/Button";
import { formatMl, type WaterLog } from "@/lib/water";
import { formatTime } from "@/lib/date";
import { updateWaterLogAction, deleteWaterLogAction } from "@/app/(app)/actions";
import styles from "./WaterLogItem.module.scss";

interface Props {
  log: WaterLog;
}

export function WaterLogItem({ log }: Props) {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [amount, setAmount] = useState<string>(String(log.amount_ml));
  const [note, setNote] = useState<string>(log.note ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const cancelEdit = () => {
    setIsEditing(false);
    setAmount(String(log.amount_ml));
    setNote(log.note ?? "");
    setError(null);
  };

  const saveEdit = () => {
    setError(null);
    startTransition(async () => {
      const res = await updateWaterLogAction({
        id: log.id,
        amountMl: Number(amount),
        note,
      });
      if (!res.ok) {
        setError(res.error ?? "Could not save.");
        return;
      }
      setIsEditing(false);
      router.refresh();
    });
  };

  const doDelete = () => {
    setError(null);
    startTransition(async () => {
      const res = await deleteWaterLogAction(log.id);
      if (!res.ok) {
        setError(res.error ?? "Could not delete.");
        setConfirmingDelete(false);
        return;
      }
      router.refresh();
    });
  };

  if (isEditing) {
    return (
      <li className={[styles.row, styles.editing].join(" ")}>
        <form
          className={styles.editForm}
          onSubmit={(e) => {
            e.preventDefault();
            saveEdit();
          }}
        >
          <div className={styles.editGrid}>
            <Input
              label="Amount"
              type="number"
              min={1}
              max={5000}
              step={1}
              inputMode="numeric"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              suffix="ml"
              required
            />
            <Input
              label="Note"
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Optional"
              maxLength={120}
            />
          </div>

          {error ? <p className={styles.error}>{error}</p> : null}

          <div className={styles.editActions}>
            <Button type="button" variant="ghost" size="md" onClick={cancelEdit} disabled={pending}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="md" loading={pending}>
              Save
            </Button>
          </div>
        </form>
      </li>
    );
  }

  return (
    <li className={styles.row}>
      <div className={styles.main}>
        <span className={styles.amount}>{formatMl(log.amount_ml)}</span>
        <span className={styles.meta}>
          {formatTime(log.logged_at)}
          {log.note ? <> · {log.note}</> : null}
        </span>
        {error ? <span className={styles.errorInline}>{error}</span> : null}
      </div>

      {confirmingDelete ? (
        <div className={styles.confirm}>
          <span className={styles.confirmLabel}>Delete?</span>
          <button
            type="button"
            className={styles.confirmYes}
            onClick={doDelete}
            disabled={pending}
            aria-label="Confirm delete"
          >
            Yes
          </button>
          <button
            type="button"
            className={styles.confirmNo}
            onClick={() => setConfirmingDelete(false)}
            disabled={pending}
            aria-label="Cancel delete"
          >
            No
          </button>
        </div>
      ) : (
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.iconBtn}
            onClick={() => setIsEditing(true)}
            aria-label="Edit entry"
            disabled={pending}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path
                d="M4 20h4l10-10-4-4L4 16v4Z"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinejoin="round"
              />
              <path
                d="m13.5 6.5 4 4"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </button>
          <button
            type="button"
            className={[styles.iconBtn, styles.iconBtnDanger].join(" ")}
            onClick={() => setConfirmingDelete(true)}
            aria-label="Delete entry"
            disabled={pending}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path
                d="M6 6l12 12M18 6L6 18"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>
      )}
    </li>
  );
}
