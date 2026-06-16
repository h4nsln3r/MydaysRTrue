"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/Button/Button";
import { Input } from "@/components/Input/Input";
import {
  addWeeklyTaskChecklistItemAction,
  deleteWeeklyTaskChecklistItemAction,
  toggleWeeklyTaskChecklistItemAction,
} from "@/app/(app)/tasks-actions";
import type { WeeklyTaskChecklistItem } from "@/lib/tasks";
import styles from "./MusicTaskChecklist.module.scss";

interface Props {
  taskId: string;
  items: WeeklyTaskChecklistItem[];
  disabled?: boolean;
}

export function MusicTaskChecklist({ taskId, items, disabled = false }: Props) {
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

  const toggle = (itemId: string, done: boolean) => {
    setError(null);
    startTransition(async () => {
      const res = await toggleWeeklyTaskChecklistItemAction({ itemId, done });
      if (!res.ok) setError(res.error ?? "Kunde inte uppdatera.");
      router.refresh();
    });
  };

  const remove = (itemId: string) => {
    setError(null);
    startTransition(async () => {
      const res = await deleteWeeklyTaskChecklistItemAction(itemId);
      if (!res.ok) setError(res.error ?? "Kunde inte ta bort.");
      router.refresh();
    });
  };

  return (
    <div className={styles.wrap}>
      <p className={styles.label}>Uppgifter att göra</p>
      {items.length > 0 ? (
        <ul className={styles.list}>
          {items.map((item) => (
            <li key={item.id} className={styles.item}>
              <button
                type="button"
                className={[
                  styles.check,
                  item.doneAt ? styles.checkDone : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                aria-label={item.doneAt ? "Markera ej klar" : "Markera klar"}
                disabled={disabled || pending}
                onClick={() => toggle(item.id, !item.doneAt)}
              >
                {item.doneAt ? (
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
              <span
                className={[styles.text, item.doneAt ? styles.textDone : ""]
                  .filter(Boolean)
                  .join(" ")}
              >
                {item.text}
              </span>
              <button
                type="button"
                className={styles.remove}
                aria-label="Ta bort"
                disabled={disabled || pending}
                onClick={() => remove(item.id)}
              >
                ×
              </button>
            </li>
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
