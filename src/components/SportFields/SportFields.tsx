"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/Button/Button";
import { Input } from "@/components/Input/Input";
import { createUserSportAction } from "@/app/(app)/sport-actions";
import { formatSportLabel, type UserSport } from "@/lib/sports";
import styles from "@/components/GameFields/GameFields.module.scss";

interface Props {
  sports: UserSport[];
  value: string | null;
  onChange: (sportId: string | null, sport?: UserSport) => void;
  disabled?: boolean;
  label?: string;
}

export function SportFields({
  sports,
  value,
  onChange,
  disabled = false,
  label = "Vilken sport?",
}: Props) {
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [extra, setExtra] = useState<UserSport[]>([]);

  const allSports = [
    ...sports,
    ...extra.filter((s) => !sports.some((x) => x.id === s.id)),
  ];

  const create = () => {
    const name = title.trim();
    if (!name) {
      setError("Skriv vilken sport det är.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await createUserSportAction({ title: name });
      if (!res.ok || !res.id) {
        setError(res.error ?? "Kunde inte lägga till sporten.");
        return;
      }
      const created: UserSport = {
        id: res.id,
        key: null,
        title: name,
        icon: "🏸",
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
            label="Sport"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="t.ex. padel, innebandy"
            maxLength={80}
            disabled={disabled || pending}
          />
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
            onChange(id, allSports.find((s) => s.id === id));
          }}
        >
          <option value="">Välj sport…</option>
          {allSports.map((s) => (
            <option key={s.id} value={s.id}>
              {formatSportLabel(s)}
            </option>
          ))}
          {value && !allSports.some((s) => s.id === value) ? (
            <option value={value}>Vald sport</option>
          ) : null}
          <option value="__new__">+ Ny sport</option>
        </select>
      )}
      {error ? <p className={styles.error}>{error}</p> : null}
    </div>
  );
}
