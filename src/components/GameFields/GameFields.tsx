"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/Button/Button";
import { Input } from "@/components/Input/Input";
import { createUserGameAction } from "@/app/(app)/game-actions";
import {
  GAME_KIND_ICON,
  GAME_KIND_LABEL,
  GAME_KINDS,
  formatGameLabel,
  type GameKind,
  type UserGame,
} from "@/lib/games";
import styles from "./GameFields.module.scss";

interface Props {
  games: UserGame[];
  value: string | null;
  onChange: (gameId: string | null, game?: UserGame) => void;
  disabled?: boolean;
  label?: string;
}

export function GameFields({
  games,
  value,
  onChange,
  disabled = false,
  label = "Vilket spel?",
}: Props) {
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<GameKind>("rpg");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [extra, setExtra] = useState<UserGame[]>([]);

  const allGames = [...games, ...extra.filter((g) => !games.some((x) => x.id === g.id))];
  const grouped = GAME_KINDS.map((k) => ({
    kind: k,
    games: allGames.filter((g) => g.kind === k),
  })).filter((g) => g.games.length > 0);

  const create = () => {
    const name = title.trim();
    if (!name) {
      setError("Skriv vilket spel det är.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await createUserGameAction({ title: name, kind });
      if (!res.ok || !res.id) {
        setError(res.error ?? "Kunde inte lägga till spelet.");
        return;
      }
      const created: UserGame = {
        id: res.id,
        key: null,
        title: name,
        kind,
        icon: GAME_KIND_ICON[kind],
        sortOrder: 999,
      };
      setExtra((prev) => [...prev, created]);
      onChange(created.id, created);
      setTitle("");
      setCreating(false);
    });
  };

  return (
    <div className={styles.wrap}>
      <span className={styles.label}>{label}</span>
      {creating ? (
        <div className={styles.create}>
          <Input
            label="Spel"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="t.ex. Catan, D&D, Hearthstone"
            maxLength={80}
            disabled={disabled || pending}
          />
          <span className={styles.label}>Kategori</span>
          <div className={styles.btns}>
            {GAME_KINDS.map((k) => (
              <button
                key={k}
                type="button"
                className={[styles.btn, kind === k ? styles.btnActive : ""]
                  .filter(Boolean)
                  .join(" ")}
                aria-pressed={kind === k}
                disabled={disabled || pending}
                onClick={() => setKind(k)}
              >
                {GAME_KIND_ICON[k]} {GAME_KIND_LABEL[k]}
              </button>
            ))}
          </div>
          <div className={styles.createActions}>
            <button
              type="button"
              className={styles.cancel}
              disabled={disabled || pending}
              onClick={() => {
                setCreating(false);
                setError(null);
              }}
            >
              Avbryt
            </button>
            <Button
              type="button"
              variant="outline"
              size="md"
              loading={pending}
              disabled={disabled || !title.trim()}
              onClick={create}
            >
              Lägg till
            </Button>
          </div>
        </div>
      ) : (
        <select
          className={styles.select}
          value={value ?? ""}
          disabled={disabled || pending}
          onChange={(e) => {
            if (e.target.value === "__new__") {
              setCreating(true);
              return;
            }
            const id = e.target.value || null;
            onChange(id, allGames.find((g) => g.id === id));
          }}
        >
          <option value="">Välj spel…</option>
          {grouped.map((group) => (
            <optgroup key={group.kind} label={GAME_KIND_LABEL[group.kind]}>
              {group.games.map((g) => (
                <option key={g.id} value={g.id}>
                  {formatGameLabel(g)}
                </option>
              ))}
            </optgroup>
          ))}
          {value && !allGames.some((g) => g.id === value) ? (
            <option value={value}>Valt spel</option>
          ) : null}
          <option value="__new__">+ Nytt spel</option>
        </select>
      )}
      {error ? <p className={styles.error}>{error}</p> : null}
    </div>
  );
}
