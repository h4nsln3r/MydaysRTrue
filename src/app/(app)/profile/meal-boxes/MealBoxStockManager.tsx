"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/Button/Button";
import { Input } from "@/components/Input/Input";
import {
  addMealBoxStockAction,
  deleteMealBoxStockAction,
  setMealBoxStockRemainingAction,
} from "@/app/(app)/meal-box-actions";
import type { MealBoxStockItem } from "@/lib/habits";
import styles from "../profile.module.scss";

interface Props {
  stock: MealBoxStockItem[];
}

export function MealBoxStockManager({ stock }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [counts, setCounts] = useState<Record<string, string>>(() =>
    Object.fromEntries(stock.map((item) => [item.id, String(item.remaining)])),
  );
  const [newDescription, setNewDescription] = useState("");
  const [newCount, setNewCount] = useState("1");
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    setCounts(
      Object.fromEntries(stock.map((item) => [item.id, String(item.remaining)])),
    );
  }, [stock]);

  const total = stock.reduce((sum, item) => sum + item.remaining, 0);

  const saveCount = (item: MealBoxStockItem) => {
    setError(null);
    const raw = counts[item.id] ?? String(item.remaining);
    const parsed = Number(raw);
    if (!Number.isFinite(parsed) || parsed < 0) {
      setError("Antal måste vara 0 eller mer.");
      return;
    }

    startTransition(async () => {
      const res = await setMealBoxStockRemainingAction({
        stockId: item.id,
        remaining: parsed,
      });
      if (!res.ok) {
        setError(res.error ?? "Kunde inte spara.");
        return;
      }
      router.refresh();
    });
  };

  const remove = (stockId: string) => {
    setError(null);
    startTransition(async () => {
      const res = await deleteMealBoxStockAction(stockId);
      if (!res.ok) {
        setError(res.error ?? "Kunde inte ta bort.");
        return;
      }
      setConfirmDeleteId(null);
      router.refresh();
    });
  };

  const addEntry = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const parsed = Number(newCount);
    if (!Number.isFinite(parsed) || parsed < 1) {
      setError("Antal måste vara minst 1.");
      return;
    }

    startTransition(async () => {
      const res = await addMealBoxStockAction({
        description: newDescription,
        remaining: parsed,
      });
      if (!res.ok) {
        setError(res.error ?? "Kunde inte lägga till.");
        return;
      }
      setNewDescription("");
      setNewCount("1");
      setAdding(false);
      router.refresh();
    });
  };

  return (
    <div className={styles.stack}>
      <p className={styles.muted}>
        {stock.length === 0
          ? "Inga matlådor registrerade just nu."
          : `${stock.length} rätter · ${total} matlådor totalt i kylen.`}
      </p>

      {error ? <p className={styles.error}>{error}</p> : null}

      {stock.length > 0 ? (
        <ul className={styles.mealBoxStockList}>
          {stock.map((item) => {
            const isConfirming = confirmDeleteId === item.id;
            const countValue = counts[item.id] ?? String(item.remaining);

            return (
              <li key={item.id} className={styles.mealBoxStockItem}>
                <div className={styles.mealBoxStockMain}>
                  <span className={styles.mealBoxStockName}>{item.description}</span>
                  <div className={styles.mealBoxStockControls}>
                    <label className={styles.mealBoxStockCountLabel}>
                      <input
                        type="number"
                        min={0}
                        max={99}
                        className={styles.mealBoxStockInput}
                        value={countValue}
                        disabled={pending}
                        onChange={(e) =>
                          setCounts((prev) => ({
                            ...prev,
                            [item.id]: e.target.value,
                          }))
                        }
                        aria-label={`Antal kvar av ${item.description}`}
                      />
                    </label>
                    <Button
                      type="button"
                      variant="outline"
                      size="md"
                      disabled={
                        pending ||
                        countValue.trim() === "" ||
                        Number(countValue) === item.remaining
                      }
                      onClick={() => saveCount(item)}
                    >
                      Spara
                    </Button>
                  </div>
                </div>
                <div className={styles.mealBoxStockActions}>
                  {isConfirming ? (
                    <>
                      <Button
                        type="button"
                        variant="ghost"
                        size="md"
                        disabled={pending}
                        onClick={() => setConfirmDeleteId(null)}
                      >
                        Avbryt
                      </Button>
                      <Button
                        type="button"
                        variant="primary"
                        size="md"
                        loading={pending}
                        onClick={() => remove(item.id)}
                      >
                        Ta bort
                      </Button>
                    </>
                  ) : (
                    <button
                      type="button"
                      className={styles.mealBoxStockRemove}
                      disabled={pending}
                      onClick={() => setConfirmDeleteId(item.id)}
                    >
                      Ta bort rätt
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}

      {adding ? (
        <form className={styles.mealBoxAddForm} onSubmit={addEntry}>
          <Input
            label="Vad är i matlådorna?"
            value={newDescription}
            onChange={(e) => setNewDescription(e.target.value)}
            placeholder="t.ex. Köttfärssås"
            maxLength={280}
            autoFocus
            required
            disabled={pending}
          />
          <Input
            label="Antal"
            type="number"
            min={1}
            max={99}
            value={newCount}
            onChange={(e) => setNewCount(e.target.value)}
            inputMode="numeric"
            required
            disabled={pending}
          />
          <div className={styles.habitFormActions}>
            <Button
              type="button"
              variant="ghost"
              size="md"
              disabled={pending}
              onClick={() => {
                setAdding(false);
                setError(null);
              }}
            >
              Avbryt
            </Button>
            <Button type="submit" variant="primary" size="md" loading={pending}>
              Lägg till
            </Button>
          </div>
        </form>
      ) : (
        <Button
          type="button"
          variant="outline"
          size="md"
          fullWidth
          onClick={() => {
            setAdding(true);
            setError(null);
          }}
        >
          + Lägg till matlådor
        </Button>
      )}
    </div>
  );
}
