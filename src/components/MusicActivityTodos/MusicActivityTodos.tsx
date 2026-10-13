"use client";

import { useEffect, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import {
  addMusicActivityTodoAction,
  deleteMusicActivityTodoAction,
  updateMusicActivityTodoAction,
} from "@/app/(app)/tasks-actions";
import {
  MUSIC_ACTIVITY_LABEL,
  musicActivityHasTodos,
  openMusicTodos,
  type MusicActivity,
  type MusicActivityTodo,
} from "@/lib/tasks";
import styles from "./MusicActivityTodos.module.scss";

interface Props {
  activity: MusicActivity | null;
  todos: readonly MusicActivityTodo[];
  placementId?: string | null;
  mode: "plan" | "complete";
  checkedIds?: string[];
  onCheckedIdsChange?: (ids: string[]) => void;
  disabled?: boolean;
}

export function MusicActivityTodos({
  activity,
  todos,
  placementId,
  mode,
  checkedIds = [],
  onCheckedIdsChange,
  disabled = false,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [draft, setDraft] = useState("");
  const [items, setItems] = useState<MusicActivityTodo[]>(() => [...todos]);
  const [confirming, setConfirming] = useState<MusicActivityTodo | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");
  const [error, setError] = useState<string | null>(null);

  const signature = todos
    .map(
      (todo) =>
        `${todo.id}:${todo.text}:${todo.doneAt ?? ""}:${todo.donePlacementId ?? ""}`,
    )
    .join("|");

  useEffect(() => {
    setItems([...todos]);
    // `signature` already tracks id and done-state. Depending on `todos`
    // would wipe a just-added row on the next parent render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);

  if (activity != null && !musicActivityHasTodos(activity)) return null;

  const visible =
    mode === "plan"
      ? openMusicTodos(items, activity)
      : items
          .filter(
            (todo) =>
              musicActivityHasTodos(activity) &&
              todo.activity === activity &&
              (todo.doneAt == null || todo.donePlacementId === placementId),
          )
          .sort(
            (a, b) =>
              a.sortOrder - b.sortOrder || a.text.localeCompare(b.text, "sv"),
          );

  const checkedTexts = visible
    .filter((todo) => checkedIds.includes(todo.id))
    .map((todo) => todo.text);

  const add = () => {
    if (!musicActivityHasTodos(activity)) return;
    const text = draft.trim();
    if (!text) return;
    setError(null);
    startTransition(async () => {
      const res = await addMusicActivityTodoAction({ activity, text });
      if (!res.ok || !res.id) {
        setError(res.error ?? "Kunde inte lägga till.");
        return;
      }
      setItems((prev) => [
        ...prev,
        {
          id: res.id!,
          activity,
          text,
          sortOrder: prev.length,
          doneAt: null,
          donePlacementId: null,
        },
      ]);
      setDraft("");
      router.refresh();
    });
  };

  const remove = (todo: MusicActivityTodo) => {
    setError(null);
    startTransition(async () => {
      const res = await deleteMusicActivityTodoAction({ id: todo.id });
      if (!res.ok) {
        setError(res.error ?? "Kunde inte ta bort.");
        return;
      }
      setItems((prev) => prev.filter((item) => item.id !== todo.id));
      onCheckedIdsChange?.(checkedIds.filter((id) => id !== todo.id));
      setConfirming(null);
      router.refresh();
    });
  };

  const startEdit = (todo: MusicActivityTodo) => {
    setError(null);
    setEditingId(todo.id);
    setEditingText(todo.text);
  };

  const saveEdit = (todo: MusicActivityTodo) => {
    const text = editingText.trim();
    if (!text || text === todo.text) {
      setEditingId(null);
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await updateMusicActivityTodoAction({ id: todo.id, text });
      if (!res.ok) {
        setError(res.error ?? "Kunde inte spara.");
        return;
      }
      setItems((prev) =>
        prev.map((item) => (item.id === todo.id ? { ...item, text } : item)),
      );
      setEditingId(null);
      router.refresh();
    });
  };

  const toggle = (id: string) => {
    if (!onCheckedIdsChange) return;
    onCheckedIdsChange(
      checkedIds.includes(id)
        ? checkedIds.filter((item) => item !== id)
        : [...checkedIds, id],
    );
  };

  return (
    <div className={styles.wrap}>
      <span className={styles.label}>Uppgifter</span>
      {activity == null ? (
        <p className={styles.hint}>Välj vad du ska göra så kan du lägga till uppgifter.</p>
      ) : (
        <>
          {visible.length === 0 ? (
            <p className={styles.hint}>Inga uppgifter än.</p>
          ) : (
            <ul className={styles.list}>
              {visible.map((todo) => {
                const open = todo.doneAt == null;
                const editing = editingId === todo.id;
                return (
                  <li key={todo.id} className={styles.row}>
                    {mode === "complete" && !editing ? (
                      <input
                        type="checkbox"
                        className={styles.check}
                        checked={checkedIds.includes(todo.id)}
                        onChange={() => toggle(todo.id)}
                        disabled={disabled || pending}
                        aria-label={`Klar med ${todo.text}`}
                      />
                    ) : null}
                    {editing ? (
                      <input
                        className={styles.input}
                        value={editingText}
                        onChange={(e) => setEditingText(e.target.value.slice(0, 200))}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            saveEdit(todo);
                          } else if (e.key === "Escape") {
                            e.preventDefault();
                            setEditingId(null);
                          }
                        }}
                        maxLength={200}
                        disabled={disabled || pending}
                        aria-label={`Ändra ${todo.text}`}
                        autoFocus
                      />
                    ) : open ? (
                      <button
                        type="button"
                        className={styles.textBtn}
                        title="Klicka för att ändra"
                        onClick={() => startEdit(todo)}
                        disabled={disabled || pending}
                      >
                        {todo.text}
                      </button>
                    ) : (
                      <span className={styles.text}>{todo.text}</span>
                    )}
                    {open && !editing ? (
                      <button
                        type="button"
                        className={styles.remove}
                        aria-label={`Ta bort ${todo.text}`}
                        disabled={disabled || pending}
                        onClick={() => setConfirming(todo)}
                      >
                        ×
                      </button>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
          <p className={styles.hint}>
            {mode === "complete"
              ? "Kryssa i det du blev klar med. Resten följer med till nästa pass."
              : "De ligger kvar på nästa pass av samma typ tills du klarmarkerar eller tar bort dem."}
          </p>
          {mode === "complete" && checkedTexts.length > 0 ? (
            <p className={styles.hint}>
              Hamnar i kommentaren och dagboken: {checkedTexts.join(", ")}
            </p>
          ) : null}
          <div className={styles.addRow}>
            <input
              className={styles.input}
              value={draft}
              onChange={(e) => setDraft(e.target.value.slice(0, 200))}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  add();
                }
              }}
              placeholder="t.ex. lära sig introt till X"
              maxLength={200}
              disabled={disabled || pending}
              aria-label="Ny uppgift"
            />
            <button
              type="button"
              className={styles.addBtn}
              onClick={add}
              disabled={disabled || pending || !draft.trim()}
            >
              Lägg till
            </button>
          </div>
        </>
      )}
      {error ? <p className={styles.error}>{error}</p> : null}
      {confirming
        ? createPortal(
            <div
              className={styles.backdrop}
              onClick={() => {
                if (!pending) setConfirming(null);
              }}
            >
              <div
                className={styles.confirm}
                role="dialog"
                aria-modal="true"
                aria-labelledby="music-todo-delete-title"
                onClick={(e) => e.stopPropagation()}
              >
                <h3 id="music-todo-delete-title" className={styles.confirmTitle}>
                  Ta bort uppgiften?
                </h3>
                <p className={styles.confirmBody}>
                  «{confirming.text}» tas bort
                  {musicActivityHasTodos(activity)
                    ? ` från alla ${MUSIC_ACTIVITY_LABEL[activity]}-pass`
                    : ""}
                  . Den kommer inte med nästa gång.
                </p>
                <div className={styles.confirmActions}>
                  <button
                    type="button"
                    className={styles.confirmCancel}
                    onClick={() => setConfirming(null)}
                    disabled={pending}
                  >
                    Avbryt
                  </button>
                  <button
                    type="button"
                    className={styles.confirmDelete}
                    onClick={() => remove(confirming)}
                    disabled={pending}
                  >
                    Ta bort
                  </button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
