"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/Button/Button";
import { Input } from "@/components/Input/Input";
import {
  addWeeklyTaskChecklistItemAction,
  deleteWeeklyTaskChecklistItemAction,
  toggleWeeklyTaskChecklistItemAction,
  updateWeeklyTaskChecklistItemAction,
} from "@/app/(app)/tasks-actions";
import type { WeeklyTaskChecklistItem } from "@/lib/tasks";
import styles from "./MusicTaskChecklist.module.scss";

interface Props {
  taskId: string;
  items: WeeklyTaskChecklistItem[];
  localDate?: string;
  disabled?: boolean;
}

export function MusicTaskChecklist({
  taskId,
  items,
  localDate,
  disabled = false,
}: Props) {
  const router = useRouter();
  const [newText, setNewText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const add = () => {
    const text = newText.trim();
    if (!text) return;
    setError(null);
    startTransition(async () => {
      const res = await addWeeklyTaskChecklistItemAction({ taskId, text });
      if (!res.ok) {
        setError(res.error ?? "Kunde inte lägga till.");
        return;
      }
      setNewText("");
      router.refresh();
    });
  };

  return (
    <div className={styles.wrap}>
      <p className={styles.label}>Uppgifter att göra</p>
      {items.length > 0 ? (
        <ul className={styles.list}>
          {items.map((item) => (
            <ChecklistItemRow
              key={item.id}
              item={item}
              localDate={localDate}
              disabled={disabled}
              pending={pending}
              onError={setError}
            />
          ))}
        </ul>
      ) : (
        <p className={styles.empty}>Inga uppgifter ännu — lägg till t.ex. en låt att lära dig.</p>
      )}
      <div className={styles.addRow}>
        <Input
          label="Ny uppgift"
          value={newText}
          onChange={(e) => setNewText(e.target.value)}
          placeholder="t.ex. Lära sig en låt"
          maxLength={200}
          disabled={disabled || pending}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
        />
        <Button
          type="button"
          variant="outline"
          size="md"
          disabled={disabled || pending || !newText.trim()}
          loading={pending}
          onClick={add}
        >
          Lägg till
        </Button>
      </div>
      {error ? <p className={styles.error}>{error}</p> : null}
    </div>
  );
}

interface ChecklistItemRowProps {
  item: WeeklyTaskChecklistItem;
  localDate?: string;
  disabled: boolean;
  pending: boolean;
  onError: (msg: string | null) => void;
}

function ChecklistItemRow({
  item,
  localDate,
  disabled,
  pending,
  onError,
}: ChecklistItemRowProps) {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(item.text);
  const [note, setNote] = useState(item.completion?.note ?? "");
  const [localPending, startTransition] = useTransition();
  const [localError, setLocalError] = useState<string | null>(null);

  const busy = disabled || pending || localPending;
  const done = Boolean(item.completion);
  const canComplete = Boolean(localDate);

  useEffect(() => {
    setNote(item.completion?.note ?? "");
  }, [item.completion?.note]);

  const toggle = (nextDone: boolean) => {
    if (!localDate) return;
    onError(null);
    startTransition(async () => {
      const res = await toggleWeeklyTaskChecklistItemAction({
        itemId: item.id,
        localDate,
        done: nextDone,
        note: nextDone ? note.trim() || null : undefined,
      });
      if (!res.ok) onError(res.error ?? "Kunde inte uppdatera.");
      router.refresh();
    });
  };

  const remove = () => {
    onError(null);
    startTransition(async () => {
      const res = await deleteWeeklyTaskChecklistItemAction(item.id);
      if (!res.ok) onError(res.error ?? "Kunde inte ta bort.");
      router.refresh();
    });
  };

  const startEdit = () => {
    setEditText(item.text);
    setLocalError(null);
    onError(null);
    setIsEditing(true);
  };

  const cancelEdit = () => {
    setIsEditing(false);
    setLocalError(null);
  };

  const saveEdit = () => {
    const text = editText.trim();
    if (!text) {
      setLocalError("Skriv en uppgift.");
      return;
    }

    setLocalError(null);
    onError(null);
    startTransition(async () => {
      const res = await updateWeeklyTaskChecklistItemAction({ itemId: item.id, text });
      if (!res.ok) {
        setLocalError(res.error ?? "Kunde inte spara.");
        return;
      }
      setIsEditing(false);
      router.refresh();
    });
  };

  if (isEditing) {
    return (
      <li className={[styles.item, styles.itemEditing].filter(Boolean).join(" ")}>
        <div className={styles.editForm}>
          <Input
            label="Uppgift"
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            maxLength={200}
            disabled={busy}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                saveEdit();
              }
              if (e.key === "Escape") cancelEdit();
            }}
          />
          {localError ? <p className={styles.error}>{localError}</p> : null}
          <div className={styles.editActions}>
            <Button
              type="button"
              variant="ghost"
              size="md"
              onClick={cancelEdit}
              disabled={busy}
            >
              Avbryt
            </Button>
            <Button
              type="button"
              variant="primary"
              size="md"
              loading={busy}
              disabled={busy}
              onClick={saveEdit}
            >
              Spara
            </Button>
          </div>
        </div>
      </li>
    );
  }

  return (
    <li className={styles.item}>
      <div className={styles.itemMain}>
        {canComplete ? (
          <button
            type="button"
            className={[
              styles.check,
              done ? styles.checkDone : "",
            ]
              .filter(Boolean)
              .join(" ")}
            aria-label={done ? "Markera ej klar" : "Markera klar"}
            disabled={busy}
            onClick={() => toggle(!done)}
          >
            {done ? (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path
                  d="M5 12.5 10 17.5 19 7.5"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            ) : null}
          </button>
        ) : (
          <span className={styles.check} aria-hidden />
        )}
        <span
          className={[styles.text, done ? styles.textDone : ""]
            .filter(Boolean)
            .join(" ")}
        >
          {item.text}
        </span>
        <button
          type="button"
          className={styles.editBtn}
          aria-label="Redigera"
          disabled={busy}
          onClick={startEdit}
        >
          ✎
        </button>
        <button
          type="button"
          className={styles.remove}
          aria-label="Ta bort"
          disabled={busy}
          onClick={remove}
        >
          ×
        </button>
      </div>
      {canComplete ? (
        <Input
          label="Kommentar (valfritt)"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          onBlur={() => {
            if (done && note !== (item.completion?.note ?? "")) {
              toggle(true);
            }
          }}
          placeholder="t.ex. lärde mig introt"
          maxLength={500}
          disabled={busy}
        />
      ) : null}
    </li>
  );
}
