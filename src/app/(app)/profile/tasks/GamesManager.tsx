"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/Button/Button";
import { Input } from "@/components/Input/Input";
import { Card } from "@/components/Card/Card";
import {
  archiveUserGameAction,
  createUserGameAction,
  updateUserGameAction,
} from "@/app/(app)/game-actions";
import {
  GAME_KIND_ICON,
  GAME_KIND_LABEL,
  GAME_KINDS,
  type GameKind,
  type UserGame,
} from "@/lib/games";
import styles from "./GamesManager.module.scss";

interface Props {
  games: UserGame[];
}

export function GamesManager({ games }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<GameKind>("rpg");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editKind, setEditKind] = useState<GameKind>("rpg");

  const refresh = () => router.refresh();

  const create = () => {
    const name = title.trim();
    if (!name) {
      setError("Skriv vilket spel det är.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await createUserGameAction({ title: name, kind });
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
      const res = await updateUserGameAction({
        id,
        title: editTitle,
        kind: editKind,
      });
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
      const res = await archiveUserGameAction({ id });
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
        <h2 className={styles.title}>Spelbibliotek</h2>
        <p className={styles.muted}>
          Välj bland de här när du drar in Spel i veckoplanen. D&D ligger som
          rollspel — lägg till brädspel, PC-spel, kortspel och mer.
        </p>
      </header>

      {error ? <p className={styles.error}>{error}</p> : null}

      <ul className={styles.list}>
        {games.map((g) => (
          <li key={g.id} className={styles.row}>
            {editingId === g.id ? (
              <div className={styles.edit}>
                <Input
                  label="Spel"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  maxLength={80}
                  disabled={pending}
                />
                <div className={styles.kinds}>
                  {GAME_KINDS.map((k) => (
                    <button
                      key={k}
                      type="button"
                      className={[
                        styles.kind,
                        editKind === k ? styles.kindActive : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      disabled={pending}
                      onClick={() => setEditKind(k)}
                    >
                      {GAME_KIND_ICON[k]} {GAME_KIND_LABEL[k]}
                    </button>
                  ))}
                </div>
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
                    onClick={() => saveEdit(g.id)}
                  >
                    Spara
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <span className={styles.name}>
                  {g.icon} {g.title}
                  <span className={styles.kindTag}>
                    {GAME_KIND_LABEL[g.kind]}
                  </span>
                </span>
                <div className={styles.actions}>
                  <button
                    type="button"
                    className={styles.linkBtn}
                    disabled={pending}
                    onClick={() => {
                      setEditingId(g.id);
                      setEditTitle(g.title);
                      setEditKind(g.kind);
                    }}
                  >
                    Ändra
                  </button>
                  <button
                    type="button"
                    className={styles.linkBtn}
                    disabled={pending}
                    onClick={() => archive(g.id)}
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
          label="Nytt spel"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="t.ex. Catan"
          maxLength={80}
          disabled={pending}
        />
        <div className={styles.kinds}>
          {GAME_KINDS.map((k) => (
            <button
              key={k}
              type="button"
              className={[styles.kind, kind === k ? styles.kindActive : ""]
                .filter(Boolean)
                .join(" ")}
              disabled={pending}
              onClick={() => setKind(k)}
            >
              {GAME_KIND_ICON[k]} {GAME_KIND_LABEL[k]}
            </button>
          ))}
        </div>
        <Button
          type="button"
          variant="primary"
          size="md"
          loading={pending}
          disabled={pending || !title.trim()}
          onClick={create}
        >
          Lägg till spel
        </Button>
      </div>
    </Card>
  );
}
