"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/Button/Button";
import { Input } from "@/components/Input/Input";
import { Card } from "@/components/Card/Card";
import {
  archiveUserSportAction,
  createUserSportAction,
  updateUserSportAction,
} from "@/app/(app)/sport-actions";
import type { UserSport } from "@/lib/sports";
import styles from "./GamesManager.module.scss";

interface Props {
  sports: UserSport[];
}

export function SportsManager({ sports }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");

  const refresh = () => router.refresh();

  const create = () => {
    const name = title.trim();
    if (!name) {
      setError("Skriv vilken sport det är.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await createUserSportAction({ title: name });
      if (!res.ok) {
        setError(res.error ?? "Kunde inte lägga till.");
        return;
      }
      setTitle("");
      refresh();
    });
  };

  const saveEdit = (id: string) => {
    setError(null);
    startTransition(async () => {
      const res = await updateUserSportAction({ id, title: editTitle });
      if (!res.ok) {
        setError(res.error ?? "Kunde inte spara.");
        return;
      }
      setEditingId(null);
      refresh();
    });
  };

  const archive = (id: string) => {
    setError(null);
    startTransition(async () => {
      const res = await archiveUserSportAction({ id });
      if (!res.ok) {
        setError(res.error ?? "Kunde inte ta bort.");
        return;
      }
      refresh();
    });
  };

  return (
    <Card>
      <header className={styles.header}>
        <h2 className={styles.title}>Sportbibliotek</h2>
        <p className={styles.muted}>
          Välj bland de här när du drar in Sportpass. Discgolf, badminton och
          pingis ligger som förval — lägg till fler när du vill.
        </p>
      </header>

      {error ? <p className={styles.error}>{error}</p> : null}

      <ul className={styles.list}>
        {sports.map((s) => (
          <li key={s.id} className={styles.row}>
            {editingId === s.id ? (
              <div className={styles.edit}>
                <Input
                  label="Sport"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  maxLength={80}
                  disabled={pending}
                />
                <div className={styles.actions}>
                  <button
                    type="button"
                    className={styles.linkBtn}
                    disabled={pending}
                    onClick={() => setEditingId(null)}
                  >
                    Avbryt
                  </button>
                  <Button
                    type="button"
                    variant="outline"
                    size="md"
                    loading={pending}
                    disabled={pending || !editTitle.trim()}
                    onClick={() => saveEdit(s.id)}
                  >
                    Spara
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <span className={styles.name}>
                  {s.icon} {s.title}
                </span>
                <div className={styles.actions}>
                  <button
                    type="button"
                    className={styles.linkBtn}
                    disabled={pending}
                    onClick={() => {
                      setEditingId(s.id);
                      setEditTitle(s.title);
                    }}
                  >
                    Ändra
                  </button>
                  <button
                    type="button"
                    className={styles.linkBtn}
                    disabled={pending}
                    onClick={() => archive(s.id)}
                  >
                    Ta bort
                  </button>
                </div>
              </>
            )}
          </li>
        ))}
      </ul>

      <div className={styles.add}>
        <Input
          label="Ny sport"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="t.ex. padel"
          maxLength={80}
          disabled={pending}
        />
        <Button
          type="button"
          variant="primary"
          size="md"
          loading={pending}
          disabled={pending || !title.trim()}
          onClick={create}
        >
          Lägg till sport
        </Button>
      </div>
    </Card>
  );
}
